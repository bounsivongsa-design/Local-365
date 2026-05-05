import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { setBusinessCompMembership } from "./comp";
import { linkReferralOnSignup, processMembershipActivation, ensureReferralCode, generateUniqueReferralCode } from "./referrals";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerStripeRoutes } from "./stripe";
import { registerAiLabRoutes } from "./aiLab";
import { registerAiFeatureRoutes } from "./aiFeatures";
import { registerNewsletterRoutes } from "./newsletter";
import { registerSocialRoutes } from "./social";
import { registerSmsRoutes } from "./sms";
import { registerReviewRequestRoutes } from "./reviewRequests";
import { registerMarketingHubRoutes } from "./marketingHub";
import { registerMultiZipRoutes } from "./multiZip";
import { registerDealRoutes } from "./deals";
import { shouldBypassCharges } from "./lib/founderRules";
import { notifyAdminNewEvent, notifyAdminNewAd, notifyAdminNewBusiness, notifyCompGranted, notifyCompRevoked, notifyCompExpiring, notifyOwnerCompExpired, notifyAdminBounceRateSpike, notifyOwnerBounceSpike } from "./email";
import { getMembershipTier, MEMBERSHIP_TIERS, EVENT_2WEEK_AD_RATES, EVENT_MONTHLY_AD_RATES, isCompActive } from "@shared/config/membership";
import db from "./lib/replitDb";
import { db as pgDb } from "./db";
import { users, receipts, quoteRequests, quotes, quotePriorityAssignments, vendorMetrics, quoteMessages, EMERGENCY_CATEGORIES, LOW_RATING_THRESHOLD } from "@shared/models/auth";
import { locations, businesses, events, adPlacements, adPricing, comments as commentsTable, posts as postsTable, categoryRequests, insertCategoryRequestSchema, promoCodes, promoCodeUsages, membershipDowngrades, jobListings, insertJobListingSchema, businessAnalytics, businessVerificationChecks, verificationDocuments, adminSubmissions, reviews, compMembershipAudit, reviewRequests, bounceRateAlerts, recipientSuppressions, bounceSpikeAlerts, requestLogs } from "@shared/schema";
import OpenAI from "openai";
import { eq, desc, and, or, ilike, inArray, sql, asc, isNull, isNotNull, lt, gt, lte, gte } from "drizzle-orm";

async function isAdminUser(userId: string): Promise<boolean> {
  const [u] = await pgDb.select({ accountType: users.accountType }).from(users).where(eq(users.id, userId));
  return u?.accountType === "admin";
}

const ADMIN_EMAILS = ["boun.sivongsa@gmail.com", "locallist365@gmail.com"];

const FOUNDER_BUSINESSES = ["Goat Locker Printing", "Blackwater Technology Solutions"];

// In-process throttle for the admin "Resend comp welcome" action. One send
// per business per minute is plenty for typo/spam-folder rescues and stops
// the button from being used to hammer a recipient. Cleared on process
// restart, which is fine — the worst case is a single duplicate after a
// deploy.
const COMP_RESEND_COOLDOWN_MS = 60_000;
const compResendThrottle = new Map<number, number>();

function normalizeBusinessName(name: string): string {
  // Strip punctuation FIRST (commas, periods, parens) so "Foo Inc., LLC" and
  // "Foo (LLC.)" both reduce to the same canonical form. Without this the
  // legal-suffix regex stripped "LLC" but left a trailing comma, breaking
  // founder-business matching for any name like "Blackwater Tech, LLC".
  return name
    .toLowerCase()
    .replace(/[,.()]/g, ' ')
    .replace(/\b(llc|inc|corp|ltd|co)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFounderBusiness(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = normalizeBusinessName(name);
  return FOUNDER_BUSINESSES.some(fb => normalizeBusinessName(fb) === normalized);
}

function getEffectiveTier(biz: { membershipTier: string | null; goldTrialEndDate: Date | null; name?: string | null; isCompedMembership?: boolean | null; compedMembershipExpiresAt?: Date | string | null }): string {
  if (biz.name && isFounderBusiness(biz.name)) {
    return "premium";
  }
  if (isCompActive(biz)) {
    return "premium";
  }
  if (biz.goldTrialEndDate && new Date(biz.goldTrialEndDate) > new Date()) {
    return "premium";
  }
  return biz.membershipTier || "none";
}

function enforceTierLimits(biz: any): any {
  const effectiveTier = getEffectiveTier(biz);
  const tierConfig = getMembershipTier(effectiveTier);
  if (!tierConfig) return biz;

  const maxCategories = tierConfig.limits.maxCategories;
  const maxPhotos = tierConfig.limits.maxPhotos;

  const result = { ...biz };

  if (result.additionalCategories && Array.isArray(result.additionalCategories)) {
    result.additionalCategories = result.additionalCategories.slice(0, Math.max(0, maxCategories - 1));
  }

  if (result.photoUrls && Array.isArray(result.photoUrls)) {
    result.photoUrls = result.photoUrls.slice(0, maxPhotos);
  }

  if (!tierConfig.limits.socialLinksAllowed) {
    result.socialMediaUrls = null;
  }

  return result;
}

async function seedAdminAccounts() {
  for (const email of ADMIN_EMAILS) {
    await pgDb.update(users)
      .set({ accountType: "admin" })
      .where(eq(users.email, email));
  }
  console.log("Admin accounts seeded for:", ADMIN_EMAILS.join(", "));
}

// Tier-Based Quote Access Timing (hours after request creation)
const GOLD_ACCESS_WINDOW_HOURS = 24;    // Gold: 1st round, 0-24 hours exclusive
const SILVER_ACCESS_START_HOURS = 24;   // Silver: 2nd round, starts at 24 hours
const SILVER_ACCESS_END_HOURS = 48;     // Silver: 2nd round, ends at 48 hours
const BRONZE_ACCESS_START_HOURS = 48;   // Bronze: 3rd round, starts at 48 hours
const QUOTE_MAX_DAYS = 10;              // All quotes expire after 10 business days
const WEEKEND_RESUME_HOUR = 7;          // Weekend quote timelines resume Mondays at 7am

// Emergency categories have compressed windows
const EMERGENCY_RESPONSE_HOURS = 2;
const STANDARD_RESPONSE_HOURS = 24;
const PRIORITY_BATCH_SIZE = 5;

// Helper: Get response window for metrics/ranking (separate from marketplace access)
function getResponseWindowHours(category: string): number {
  const isEmergency = EMERGENCY_CATEGORIES.some(cat => 
    category.toLowerCase().includes(cat.toLowerCase())
  );
  return isEmergency ? EMERGENCY_RESPONSE_HOURS : STANDARD_RESPONSE_HOURS;
}

// Helper: Determine which tier has marketplace access to a request based on creation time
// Access windows are the same for all categories (Gold 0-24h, Silver 24-48h, Bronze 48+h)
// Emergency response metrics use shorter windows (2h) but marketplace access is unchanged
function getTierAccessForRequest(createdAt: Date): { gold: boolean; silver: boolean; bronze: boolean } {
  const hoursElapsed = (Date.now() - createdAt.getTime()) / (1000 * 60 * 60);
  return {
    gold: true,
    silver: hoursElapsed >= SILVER_ACCESS_START_HOURS,
    bronze: hoursElapsed >= BRONZE_ACCESS_START_HOURS,
  };
}

// Helper: Check if a specific tier level has access to a request
function doesTierHaveAccess(tier: string, createdAt: Date): boolean {
  const access = getTierAccessForRequest(createdAt);
  switch (tier) {
    case "premium": return access.gold;
    case "standard": return access.silver;
    case "basic": return access.bronze;
    default: return false;
  }
}

// Helper: Calculate business hours elapsed (excludes weekends, resumes Monday 7am)
function getBusinessHoursElapsed(createdAt: Date): number {
  let hours = 0;
  const now = new Date();
  const current = new Date(createdAt);
  while (current < now) {
    const day = current.getDay();
    if (day !== 0 && day !== 6) {
      const remaining = Math.min((now.getTime() - current.getTime()) / (1000 * 60 * 60), 1);
      hours += remaining;
      current.setTime(current.getTime() + 60 * 60 * 1000);
    } else {
      // Skip to Monday 7am
      const daysUntilMonday = day === 6 ? 2 : 1;
      current.setDate(current.getDate() + daysUntilMonday);
      current.setHours(WEEKEND_RESUME_HOUR, 0, 0, 0);
    }
  }
  return hours;
}

// Helper: Calculate quote expiration (10 business days from creation)
function calculateQuoteExpiration(createdAt: Date): Date {
  const expiry = new Date(createdAt);
  let businessDays = 0;
  while (businessDays < QUOTE_MAX_DAYS) {
    expiry.setDate(expiry.getDate() + 1);
    const day = expiry.getDay();
    if (day !== 0 && day !== 6) businessDays++;
  }
  expiry.setHours(23, 59, 59, 999);
  return expiry;
}

// Helper: Calculate priority expiry timestamp
function calculatePriorityExpiry(category: string): Date {
  const hours = getResponseWindowHours(category);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

// Helper: Assign priority to top premium businesses for a quote request
async function assignPriorityToPremiumBusinesses(
  requestId: number,
  category: string,
  customerRating: number,
  priorityRound: number = 1
): Promise<void> {
  const expiresAt = calculatePriorityExpiry(category);
  
  // Get premium businesses in matching category, sorted by:
  // 1. Membership tier (Premium > Standard > Basic)
  // 2. Average rating (highest first)
  // 3. Review count (most reviews first)
  const eligibleBusinesses = await pgDb
    .select({
      id: businesses.id,
      membershipTier: businesses.membershipTier,
      averageRating: sql<number>`COALESCE((SELECT AVG(${reviews.rating}) FROM ${reviews} WHERE ${reviews.businessId} = ${businesses.id}), 0)`.as("avg_rating"),
      reviewCount: sql<number>`COALESCE((SELECT COUNT(*) FROM ${reviews} WHERE ${reviews.businessId} = ${businesses.id}), 0)`.as("review_count"),
    })
    .from(businesses)
    .where(
      and(
        eq(businesses.category, category),
        or(
          eq(businesses.membershipTier, "premium"),
          eq(businesses.membershipTier, "standard"),
          eq(businesses.membershipTier, "basic")
        ),
        sql`${businesses.acceptsQuotes} IS NOT FALSE`
      )
    )
    .orderBy(
      sql`CASE 
        WHEN ${businesses.membershipTier} = 'premium' THEN 1 
        WHEN ${businesses.membershipTier} = 'standard' THEN 2 
        WHEN ${businesses.membershipTier} = 'basic' THEN 3 
        ELSE 4 
      END`,
      sql`COALESCE((SELECT AVG(${reviews.rating}) FROM ${reviews} WHERE ${reviews.businessId} = ${businesses.id}), 0) DESC`,
      sql`COALESCE((SELECT COUNT(*) FROM ${reviews} WHERE ${reviews.businessId} = ${businesses.id}), 0) DESC`
    );
  
  // Calculate which businesses to assign for this round
  const startIdx = (priorityRound - 1) * PRIORITY_BATCH_SIZE;
  const endIdx = startIdx + PRIORITY_BATCH_SIZE;
  const batchBusinesses = eligibleBusinesses.slice(startIdx, endIdx);
  
  // Create priority assignments for these businesses
  if (batchBusinesses.length > 0) {
    const assignments = batchBusinesses.map(biz => ({
      requestId,
      businessId: biz.id,
      priorityRound,
      expiresAt,
      customerRatingAtTime: customerRating.toString(),
    }));
    
    await pgDb.insert(quotePriorityAssignments).values(assignments);
    
    // Update the quote request with priority info
    await pgDb.update(quoteRequests)
      .set({ 
        priorityRound,
        priorityExpiresAt: expiresAt 
      })
      .where(eq(quoteRequests.id, requestId));
  }
}

// Helper: Update vendor metrics when a quote is submitted
async function updateVendorMetricsOnResponse(
  businessId: number,
  requestId: number,
  responseTimeMinutes: number,
  category: string,
  customerRating: number
): Promise<void> {
  // Determine if response is on-time based on actual response window
  const responseWindowMinutes = getResponseWindowHours(category) * 60;
  const isOnTime = responseTimeMinutes <= responseWindowMinutes;
  const isLowRatedCustomer = customerRating < LOW_RATING_THRESHOLD;
  
  // Get or create vendor metrics
  let metrics = await pgDb.select().from(vendorMetrics)
    .where(eq(vendorMetrics.businessId, businessId))
    .limit(1);
  
  if (metrics.length === 0) {
    // Create new metrics record
    // For low-rated customers, late responses don't count against the vendor
    await pgDb.insert(vendorMetrics).values({
      businessId,
      totalAssignments: 1,
      responsesOnTime: isOnTime ? 1 : 0,
      responsesLate: (isOnTime || isLowRatedCustomer) ? 0 : 1,
      noResponses: 0,
      averageResponseMinutes: responseTimeMinutes,
      responseRating: "5.00",
      penaltyExemptNoResponses: 0,
    });
  } else {
    // Update existing metrics
    const m = metrics[0];
    const newTotal = (m.totalAssignments || 0) + 1;
    const newOnTime = (m.responsesOnTime || 0) + (isOnTime ? 1 : 0);
    // Don't penalize for late responses to low-rated customers
    const newLate = (m.responsesLate || 0) + ((isOnTime || isLowRatedCustomer) ? 0 : 1);
    
    // Calculate new average response time
    const prevAvg = m.averageResponseMinutes || responseTimeMinutes;
    const newAvg = Math.round((prevAvg * (newTotal - 1) + responseTimeMinutes) / newTotal);
    
    // Calculate response rating (higher is better)
    // Formula: (onTime responses / total countable responses) * 5
    // Exclude low-rated customer late responses from the denominator
    const totalCountableResponses = newOnTime + newLate + (m.noResponses || 0);
    const newRating = totalCountableResponses > 0 
      ? ((newOnTime / totalCountableResponses) * 5).toFixed(2)
      : "5.00";
    
    await pgDb.update(vendorMetrics)
      .set({
        totalAssignments: newTotal,
        responsesOnTime: newOnTime,
        responsesLate: newLate,
        averageResponseMinutes: newAvg,
        responseRating: newRating,
        lastUpdated: new Date(),
      })
      .where(eq(vendorMetrics.businessId, businessId));
  }
  
  // Mark the priority assignment as responded
  await pgDb.update(quotePriorityAssignments)
    .set({ respondedAt: new Date() })
    .where(
      and(
        eq(quotePriorityAssignments.requestId, requestId),
        eq(quotePriorityAssignments.businessId, businessId)
      )
    );
}

// Helper: Check and advance expired priority rounds
async function processExpiredPriorityAssignments(): Promise<void> {
  const now = new Date();
  
  // Find requests with expired priority windows that haven't been advanced
  const expiredRequests = await pgDb.select()
    .from(quoteRequests)
    .where(
      and(
        eq(quoteRequests.status, "open"),
        lt(quoteRequests.priorityExpiresAt, now)
      )
    );
  
  for (const request of expiredRequests) {
    // Mark expired assignments
    await pgDb.update(quotePriorityAssignments)
      .set({ expired: true })
      .where(
        and(
          eq(quotePriorityAssignments.requestId, request.id),
          isNull(quotePriorityAssignments.respondedAt),
          lt(quotePriorityAssignments.expiresAt, now)
        )
      );
    
    // Update metrics for no-response (only if customer rating was good)
    const expiredAssignments = await pgDb.select()
      .from(quotePriorityAssignments)
      .where(
        and(
          eq(quotePriorityAssignments.requestId, request.id),
          eq(quotePriorityAssignments.expired, true),
          isNull(quotePriorityAssignments.respondedAt)
        )
      );
    
    for (const assignment of expiredAssignments) {
      const customerRating = Number(assignment.customerRatingAtTime) || 5.0;
      const isLowRatedCustomer = customerRating < LOW_RATING_THRESHOLD;
      
      // Update vendor metrics
      let metrics = await pgDb.select().from(vendorMetrics)
        .where(eq(vendorMetrics.businessId, assignment.businessId))
        .limit(1);
      
      if (metrics.length === 0) {
        await pgDb.insert(vendorMetrics).values({
          businessId: assignment.businessId,
          totalAssignments: 1,
          responsesOnTime: 0,
          responsesLate: 0,
          noResponses: isLowRatedCustomer ? 0 : 1,
          penaltyExemptNoResponses: isLowRatedCustomer ? 1 : 0,
          responseRating: isLowRatedCustomer ? "5.00" : "4.00",
        });
      } else {
        const m = metrics[0];
        const newTotal = (m.totalAssignments || 0) + 1;
        const newNoResponse = (m.noResponses || 0) + (isLowRatedCustomer ? 0 : 1);
        const newPenaltyExempt = (m.penaltyExemptNoResponses || 0) + (isLowRatedCustomer ? 1 : 0);
        
        // Recalculate rating (don't penalize for low-rated customers)
        const countableResponses = (m.responsesOnTime || 0) + (m.responsesLate || 0) + newNoResponse;
        const newRating = countableResponses > 0
          ? (((m.responsesOnTime || 0) / countableResponses) * 5).toFixed(2)
          : "5.00";
        
        await pgDb.update(vendorMetrics)
          .set({
            totalAssignments: newTotal,
            noResponses: newNoResponse,
            penaltyExemptNoResponses: newPenaltyExempt,
            responseRating: newRating,
            lastUpdated: new Date(),
          })
          .where(eq(vendorMetrics.businessId, assignment.businessId));
      }
    }
    
    // Get customer rating for next round
    const customer = await pgDb.select({ customerRating: users.customerRating })
      .from(users)
      .where(eq(users.id, request.userId))
      .limit(1);
    const customerRating = Number(customer[0]?.customerRating) || 5.0;
    
    // Advance to next priority round
    const nextRound = (request.priorityRound || 1) + 1;
    await assignPriorityToPremiumBusinesses(
      request.id,
      request.category,
      customerRating,
      nextRound
    );
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Object Storage Routes
  registerObjectStorageRoutes(app);

  // Stripe Payment Routes
  registerStripeRoutes(app);

  // AI Lab (sandbox) — Phase 1A: credits + revenue dashboard
  registerAiLabRoutes(app);
  registerAiFeatureRoutes(app);
  registerNewsletterRoutes(app);
  registerSocialRoutes(app);
  registerSmsRoutes(app);
  registerReviewRequestRoutes(app);
  registerMarketingHubRoutes(app);
  registerMultiZipRoutes(app);
  registerDealRoutes(app);

  // ============ LOCATION ROUTES ============
  
  // Get all active locations
  app.get("/api/locations", async (req, res) => {
    try {
      const allLocations = await pgDb.select().from(locations).where(eq(locations.isActive, true));
      res.json(allLocations);
    } catch (err) {
      console.error("Error fetching locations:", err);
      res.status(500).json({ message: "Failed to fetch locations" });
    }
  });

  // Search locations by zip, city, or state
  app.get("/api/locations/search", async (req, res) => {
    try {
      const { q } = req.query;
      if (!q || typeof q !== "string") {
        return res.status(400).json({ message: "Search query required" });
      }
      
      const searchTerm = `%${q}%`;
      // First try standard text fields
      let results = await pgDb.select().from(locations).where(
        and(
          eq(locations.isActive, true),
          or(
            ilike(locations.city, searchTerm),
            ilike(locations.state, searchTerm),
            ilike(locations.name, searchTerm),
            ilike(locations.region, searchTerm)
          )
        )
      );
      
      // If no results and query looks like a zip code (5 digits), search zipCodes array
      if (results.length === 0 && /^\d{5}$/.test(q)) {
        const allLocations = await pgDb.select().from(locations).where(eq(locations.isActive, true));
        results = allLocations.filter(loc => loc.zipCodes?.includes(q));
      }
      
      res.json(results);
    } catch (err) {
      console.error("Error searching locations:", err);
      res.status(500).json({ message: "Failed to search locations" });
    }
  });

  // Get businesses by location
  app.get("/api/businesses/by-location", async (req, res) => {
    try {
      const { city, state, zipCode } = req.query;
      
      let conditions = [];
      if (city) conditions.push(ilike(businesses.city, `%${city}%`));
      if (state) conditions.push(eq(businesses.state, state as string));
      if (zipCode) conditions.push(eq(businesses.zipCode, zipCode as string));
      
      if (conditions.length === 0) {
        // Default to all businesses if no filter
        const allBusinesses = await storage.getBusinesses();
        return res.json(allBusinesses);
      }
      
      const locationBusinesses = await pgDb.select().from(businesses)
        .where(and(...conditions))
        .orderBy(
          sql`CASE 
            WHEN ${businesses.membershipTier} = 'premium' THEN 1 
            WHEN ${businesses.membershipTier} = 'standard' THEN 2 
            WHEN ${businesses.membershipTier} = 'basic' THEN 3 
            ELSE 4 
          END`,
          desc(businesses.averageRating),
          desc(businesses.reviewCount)
        );
      res.json(locationBusinesses);
    } catch (err) {
      console.error("Error fetching businesses by location:", err);
      res.status(500).json({ message: "Failed to fetch businesses" });
    }
  });

  // Get events by location
  app.get("/api/events/by-location", async (req, res) => {
    try {
      const { city, state, zipCode } = req.query;
      
      let conditions = [];
      if (city) conditions.push(ilike(events.city, `%${city}%`));
      if (state) conditions.push(eq(events.state, state as string));
      if (zipCode) conditions.push(eq(events.zipCode, zipCode as string));
      
      conditions.push(eq(events.status, "approved"));
      
      if (conditions.length === 1) {
        const allEvents = await storage.getEvents();
        return res.json(allEvents.filter(e => e.status === "approved"));
      }
      
      const locationEvents = await pgDb.select().from(events).where(and(...conditions));
      res.json(locationEvents);
    } catch (err) {
      console.error("Error fetching events by location:", err);
      res.status(500).json({ message: "Failed to fetch events" });
    }
  });

  // User validation status
  app.get("/api/user/validation-status", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const userReceipts = await pgDb.select().from(receipts).where(eq(receipts.userId, userId));
      
      res.json({
        isValidated: user[0].isValidated || false,
        receipts: userReceipts
      });
    } catch (err) {
      console.error("Error fetching validation status:", err);
      res.status(500).json({ message: "Failed to fetch validation status" });
    }
  });

  // Submit receipt for validation
  app.post("/api/user/receipts", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { fileName, fileUrl } = req.body;
      if (!fileName || !fileUrl) {
        return res.status(400).json({ message: "File name and URL are required" });
      }
      
      const [newReceipt] = await pgDb.insert(receipts).values({
        userId,
        fileName,
        fileUrl,
        status: "pending"
      }).returning();
      
      res.status(201).json(newReceipt);
    } catch (err) {
      console.error("Error submitting receipt:", err);
      res.status(500).json({ message: "Failed to submit receipt" });
    }
  });

  // Get user's receipts
  app.get("/api/user/receipts", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const userReceipts = await pgDb.select().from(receipts).where(eq(receipts.userId, userId));
      res.json(userReceipts);
    } catch (err) {
      console.error("Error fetching receipts:", err);
      res.status(500).json({ message: "Failed to fetch receipts" });
    }
  });

  // Best of Moyock
  app.post("/api/bestof", isAuthenticated, async (req, res) => {
    try {
      const { category, winner, runnerUp, honorable, rating } = req.body;
      
      if (!category || !winner) {
        return res.status(400).json({ message: "Category and winner are required" });
      }

      const result = await db.get("bestof");
      const currentBestOf = (result.ok && result.value) ? result.value as any[] : [];
      
      // Check if category exists and update, otherwise add new
      const existingIndex = currentBestOf.findIndex((item: any) => item.category === category);
      const newEntry = { category, winner, runnerUp, honorable, rating };
      
      if (existingIndex >= 0) {
        currentBestOf[existingIndex] = newEntry;
      } else {
        currentBestOf.push(newEntry);
      }
      
      await db.set("bestof", currentBestOf);
      res.json({ message: "Entry saved successfully", entry: newEntry });
    } catch (err) {
      res.status(500).json({ message: "Failed to save best of entry" });
    }
  });

  app.get("/api/bestof", async (req, res) => {
    try {
      const result = await db.get("bestof");
      if (result.ok && result.value) {
        res.json(result.value);
      } else {
        // Return default data if none in DB
        const defaultBestOf = [
          { category: 'Home Repair', winner: 'Smith Home Repair', runnerUp: 'Moyock Handyman Services', honorable: 'Shore Home Fixers', rating: '4.9' },
          { category: 'Plumbing', winner: 'Coastal Plumbing Co', runnerUp: 'Moyock Plumbing Pros', honorable: 'Moyock Pipe Works', rating: '4.8' },
          { category: 'HVAC', winner: 'Moyock HVAC Pros', runnerUp: 'Coastal Comfort Air', honorable: 'Moyock Climate Control', rating: '4.9' },
          { category: 'Electrical', winner: 'Shore Electric', runnerUp: 'Lighthouse Electrical', honorable: 'Moyock Power Solutions', rating: '4.7' },
          { category: 'Roofing', winner: 'Moyock Roofing Co', runnerUp: 'Coastal Storm Roofing', honorable: 'Moyock Top Roofers', rating: '4.8' },
          { category: 'Landscaping', winner: 'Sandy Shores Landscaping', runnerUp: 'Moyock Gardens', honorable: 'Coastal Green Thumb', rating: '4.9' },
          { category: 'Cleaning', winner: 'Crystal Clean Moyock', runnerUp: 'Sparkle Cleaning Co', honorable: 'Tidy Moyock Services', rating: '4.8' },
          { category: 'Painting', winner: 'Moyock Painters', runnerUp: 'Coastal Colors Pro', honorable: 'Moyock Painting Co', rating: '4.7' },
          { category: 'Tree Care', winner: 'Coastal Tree Care', runnerUp: 'Moyock Arborists', honorable: 'Moyock Tree Service', rating: '4.8' },
          { category: 'Remodeling & Addition', winner: 'Moyock Home Remodeling', runnerUp: 'Moyock Renovations', honorable: 'Coastal Makeover Co', rating: '4.9' },
          { category: 'New Construction', winner: 'Moyock Custom Builders', runnerUp: 'Moyock Construction Co', honorable: 'Soundside Builders', rating: '4.8' },
          { category: 'Baby Sitting & Nanny', winner: 'Trusted Nannies Moyock', runnerUp: 'Moyock Kids Care', honorable: 'Coastal Sitters', rating: '4.9' },
          { category: 'Printing', winner: 'Coastal Print Shop', runnerUp: 'Moyock Graphics', honorable: 'Moyock Signs & Print', rating: '4.6' },
          { category: 'Web Design & Logo Design', winner: 'Moyock Digital Design', runnerUp: 'Moyock Web Studio', honorable: 'Coastal Creative Co', rating: '4.8' },
          { category: 'Photo & Video', winner: 'Moyock Photo & Video', runnerUp: 'Lighthouse Lens', honorable: 'Moyock Shots', rating: '4.9' },
          { category: 'Auto Repair', winner: 'Reliable Auto Repair', runnerUp: 'Moyock Garage', honorable: 'Moyock Auto Care', rating: '4.7' },
          { category: 'Small Engine Repair', winner: 'Small Engine Experts', runnerUp: 'Moyock Power Equipment', honorable: 'Coastal Motor Works', rating: '4.6' },
          { category: 'Trash & Junk Removal', winner: 'Junk Be Gone Moyock', runnerUp: 'Coastal Cleanout', honorable: 'Moyock Haul Away', rating: '4.8' },
          { category: 'Tutor & Mentor Counseling', winner: 'Moyock Tutoring Center', runnerUp: 'Bright Minds Moyock', honorable: 'Coastal Learning', rating: '4.9' },
          { category: 'Health & Wellness', winner: 'Serenity Wellness', runnerUp: 'Moyock Yoga Studio', honorable: 'Coastal Zen Center', rating: '4.9' },
          { category: 'Tax CPA', winner: 'Coastal Tax Services', runnerUp: 'Moyock Accounting', honorable: 'Moyock Business CPAs', rating: '4.7' },
          { category: 'Legal', winner: 'Moyock Law Group', runnerUp: 'Moyock Legal Services', honorable: 'Coastal Attorneys', rating: '4.8' },
          { category: 'Woodworking', winner: 'Moyock Woodworks', runnerUp: 'Coastal Craftsmen', honorable: 'Moyock Timber Creations', rating: '4.9' },
          { category: 'Baking & Cooking', winner: 'Sweet Coastal Bakery', runnerUp: 'Moyock Bakehouse', honorable: 'Moyock Bread Company', rating: '4.9' },
          { category: 'Catering / Food Trucks', winner: 'Moyock Food Truck Co', runnerUp: 'Coastal Catering Co', honorable: 'Moyock Bites Mobile', rating: '4.8' },
          { category: 'Event Planning & Rentals', winner: 'Coastal Events & Rentals', runnerUp: 'Moyock Party Pros', honorable: 'Moyock Celebration Co', rating: '4.8' },
        ];
        res.json(defaultBestOf);
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch best of data" });
    }
  });

  // Affiliate Click Tracking
  app.post("/api/affiliate-clicks", async (req, res) => {
    try {
      const { businessName, referralCode, category, timestamp } = req.body;
      
      if (!businessName || !referralCode) {
        return res.status(400).json({ message: "Business name and referral code are required" });
      }

      // Get existing clicks
      const result = await db.get("affiliate_clicks");
      const clicks = (result.ok && result.value) ? result.value as any[] : [];
      
      // Add new click
      clicks.push({
        businessName,
        referralCode,
        category,
        timestamp: timestamp || new Date().toISOString(),
        userAgent: req.headers['user-agent'],
        ip: req.ip
      });
      
      await db.set("affiliate_clicks", clicks);
      
      console.log(`[Affiliate] Click tracked: ${referralCode} -> ${businessName}`);
      res.json({ success: true, message: "Click tracked" });
    } catch (err) {
      console.error("Failed to track affiliate click:", err);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // Get affiliate click stats (for admin)
  app.get("/api/affiliate-clicks", isAuthenticated, async (req, res) => {
    try {
      const result = await db.get("affiliate_clicks");
      if (result.ok && result.value) {
        res.json(result.value);
      } else {
        res.json([]);
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch affiliate clicks" });
    }
  });

  // Businesses
  app.get(api.businesses.list.path, async (req, res) => {
    const category = req.query.category as string | undefined;
    const search = req.query.search as string | undefined;
    const businessList = await storage.getBusinesses(category, search);
    res.json(businessList.map(enforceTierLimits));
  });

  app.get(api.businesses.get.path, async (req, res) => {
    const businessId = Number(req.params.id);
    const business = await storage.getBusiness(businessId);
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }
    const reviewsList = await storage.getReviewsForBusiness(businessId);
    res.json({ ...enforceTierLimits(business), reviews: reviewsList });
  });

  app.post(api.businesses.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.businesses.create.input.parse(req.body);

      const existingBiz = await pgDb.select({ id: businesses.id })
        .from(businesses)
        .where(
          and(
            ilike(businesses.name, input.name),
            eq(businesses.zipCode, input.zipCode || "27958")
          )
        )
        .limit(1);

      if (existingBiz.length > 0) {
        return res.status(409).json({ message: "A business with this name already exists in this zip code" });
      }

      const userId = (req as any).user?.id;

      delete input.membershipTier;
      delete input.membershipPaymentFrequency;
      delete input.membershipStartDate;
      delete input.membershipEndDate;
      delete input.stripeSubscriptionId;
      delete input.stripeCustomerId;
      delete input.membershipTrialUsed;
      delete input.isExample;
      delete input.verified;

      const [currentUser] = userId ? await pgDb.select().from(users).where(eq(users.id, userId)) : [];
      console.log(`[CREATE-BIZ] userId=${userId}, pendingTier=${currentUser?.pendingMembershipTier}, pendingSub=${currentUser?.pendingStripeSubscriptionId}, stripeSessionId=${req.body.stripeSessionId || 'none'}`);

      if (currentUser?.pendingMembershipTier) {
        input.membershipTier = currentUser.pendingMembershipTier;
        input.membershipPaymentFrequency = currentUser.pendingPaymentFrequency;
        input.membershipStartDate = new Date();
        input.stripeSubscriptionId = currentUser.pendingStripeSubscriptionId;
        input.stripeCustomerId = currentUser.stripeCustomerId;
        input.membershipTrialUsed = true;
        console.log(`[CREATE-BIZ] Applied pending membership: tier=${input.membershipTier}`);

        if (currentUser.pendingStripeSubscriptionId) {
          try {
            const stripe = (await import("stripe")).default;
            const stripeClient = new stripe(process.env.Stripeintegration || "");
            const sub = await stripeClient.subscriptions.retrieve(currentUser.pendingStripeSubscriptionId);
            const isAutoUpgrade = sub.metadata?.isAutoUpgrade === "true";
            const originalTier = sub.metadata?.originalTier;
            if (sub.trial_end && isAutoUpgrade && originalTier) {
              input.goldTrialEndDate = new Date(sub.trial_end * 1000);
              input.originalMembershipTier = originalTier;
              console.log(`[CREATE-BIZ] Gold trial applied: ends=${input.goldTrialEndDate}, originalTier=${originalTier}`);
            }
          } catch (e: any) {
            console.error("Failed to retrieve subscription for gold trial info:", e?.message);
          }
        }
      }

      const stripeSessionId = req.body.stripeSessionId;
      if (!input.membershipTier && stripeSessionId && userId) {
        try {
          const stripe = (await import("stripe")).default;
          const stripeClient = new stripe(process.env.Stripeintegration || "");
          const session = await stripeClient.checkout.sessions.retrieve(stripeSessionId);

          if (session && session.metadata?.userId === userId) {
            const tier = session.metadata?.tier;
            const frequency = session.metadata?.frequency;
            const subscriptionId = session.subscription as string;

            if (tier && (session.payment_status === "paid" || subscriptionId)) {
              input.membershipTier = tier;
              input.membershipPaymentFrequency = frequency;
              input.membershipStartDate = new Date();
              input.stripeSubscriptionId = subscriptionId;
              input.stripeCustomerId = session.customer as string;
              input.membershipTrialUsed = true;

              if (subscriptionId) {
                try {
                  const sub = await stripeClient.subscriptions.retrieve(subscriptionId);
                  const isAutoUpgrade = session.metadata?.isAutoUpgrade === "true";
                  const originalTier = session.metadata?.originalTier;
                  if (sub.trial_end && isAutoUpgrade && originalTier) {
                    input.goldTrialEndDate = new Date(sub.trial_end * 1000);
                    input.originalMembershipTier = originalTier;
                  }
                } catch (e: any) {
                  console.error("Failed to retrieve subscription for gold trial:", e?.message);
                }
              }

              console.log(`Membership applied directly from Stripe session during business creation: tier=${tier}, userId=${userId}`);
            }
          } else {
            console.warn(`Stripe session userId mismatch: session=${session.metadata?.userId}, auth=${userId}`);
          }
        } catch (e: any) {
          console.error("Failed to verify Stripe session during business creation:", e?.message);
        }
      }

      console.log(`[CREATE-BIZ] Final tier being saved: membershipTier=${input.membershipTier || 'NOT SET'}, goldTrialEndDate=${input.goldTrialEndDate || 'none'}, originalTier=${input.originalMembershipTier || 'none'}`);

      if (!input.membershipTier || input.membershipTier === "none") {
        return res.status(400).json({ message: "A membership plan is required. Please choose a plan before creating your business listing." });
      }

      // Auto-issue this business's own referral code so they can start
      // sharing immediately. Stored on the row before insert.
      if (!input.referralCode) {
        input.referralCode = await generateUniqueReferralCode();
      }

      if (userId && !input.ownerUserId) {
        input.ownerUserId = userId;
      }
      const business = await storage.createBusiness(input);
      console.log(`[CREATE-BIZ] Business created: id=${business.id}, name="${business.name}", membershipTier=${business.membershipTier}, ownerUserId=${business.ownerUserId}`);

      // If they pasted a referral code, create the pending link.
      if (business.referredByCode) {
        const linkResult = await linkReferralOnSignup(business.id, business.referredByCode);
        console.log(`[CREATE-BIZ] Referral link result for biz=${business.id}:`, linkResult);
      }

      // Fire-and-await: deliver any referral reward + assign founding number.
      // Idempotent and tolerates failure.
      await processMembershipActivation(business.id).catch((e) =>
        console.error("[referrals] createBusiness activation hook:", e),
      );

      notifyAdminNewBusiness(business.name, currentUser?.email || "", business.membershipTier || "").catch(() => {});

      if (userId) {
        const updateFields: any = { linkedBusinessId: business.id };
        if (currentUser?.accountType !== "admin") {
          updateFields.accountType = "business";
        }
        if (currentUser?.pendingMembershipTier) {
          updateFields.pendingMembershipTier = null;
          updateFields.pendingStripeSubscriptionId = null;
          updateFields.pendingPaymentFrequency = null;
        }
        updateFields.pendingBusinessName = null;
        await pgDb.update(users).set(updateFields).where(eq(users.id, userId));
        console.log(`[CREATE-BIZ] User ${userId} accountType set to "business", linkedBusinessId=${business.id}`);

        const subIdToUpdate = currentUser?.pendingStripeSubscriptionId || input.stripeSubscriptionId;
        if (subIdToUpdate) {
          try {
            const stripe = (await import("stripe")).default;
            const stripeClient = new stripe(process.env.Stripeintegration || "");
            await stripeClient.subscriptions.update(subIdToUpdate, {
              metadata: { businessId: String(business.id) },
            });
          } catch (e) {
            console.error("Failed to update Stripe subscription metadata:", e);
          }
        }
      }
      
      if (business.hasLLC) {
        try {
          const openai = new OpenAI({
            apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
            baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
          });
          const searchPrompt = `You are verifying a business registration with the North Carolina Secretary of State (sosnc.gov).

Business Name: "${business.name}"
Owner Name: "${input.ownerName || 'Not provided'}"
Location: Currituck County, NC (zip: ${input.zipCode || input.establishedZipCode || '27958'})
Claims LLC: Yes

Based on your knowledge of NC business registrations and common naming patterns, analyze this business:

1. Is "${business.name}" likely to be found as a registered entity (LLC, Corp, LP, etc.) with the NC Secretary of State?
2. What is the most likely registered name variant? (e.g., "${business.name} LLC", "${business.name} Inc")
3. Based on the name and location, does this appear to be a legitimate local business?

Respond in this exact JSON format:
{
  "registrationLikelihood": "high" | "medium" | "low" | "unknown",
  "likelyEntityType": "LLC" | "Corporation" | "Sole Proprietorship" | "Partnership" | "Unknown",
  "likelyRegisteredName": "string",
  "statusAssessment": "likely_active" | "uncertain" | "likely_not_registered",
  "sosSearchUrl": "https://www.sosnc.gov/online_services/search/by_title/_Business_Registration",
  "confidence": "high" | "medium" | "low",
  "notes": "Brief explanation of assessment",
  "flags": ["array of any concerns or notable findings"]
}`;
          const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: searchPrompt }],
            temperature: 0.2,
            response_format: { type: "json_object" },
          });
          const aiResult = completion.choices[0]?.message?.content || "{}";
          let parsed: any = {};
          try { parsed = JSON.parse(aiResult); } catch { parsed = {}; }
          const checkStatus = parsed.registrationLikelihood === "high" ? "verified" :
                             parsed.registrationLikelihood === "medium" ? "review_needed" :
                             parsed.registrationLikelihood === "low" ? "not_found" : "review_needed";
          await pgDb.insert(businessVerificationChecks).values({
            businessId: business.id,
            checkType: "nc_sos",
            status: checkStatus,
            result: parsed.statusAssessment === "likely_active" ? `Likely registered as ${parsed.likelyEntityType || "business entity"}` : "Needs manual verification",
            details: JSON.stringify(parsed),
            rawResponse: aiResult,
            checkedAt: new Date(),
          });
        } catch (aiErr) {
          console.error("Auto SOS check failed (non-blocking):", aiErr);
        }
      }

      res.status(201).json(business);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  });

  app.post("/api/businesses/:id/verify-sos", isAuthenticated, async (req: any, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = req.user?.id;

      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Business not found" });

      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || (user.linkedBusinessId !== businessId && user.accountType !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const existingCheck = await pgDb.select().from(businessVerificationChecks)
        .where(and(
          eq(businessVerificationChecks.businessId, businessId),
          eq(businessVerificationChecks.checkType, "nc_sos")
        )).limit(1);

      if (existingCheck.length > 0 && existingCheck[0].status !== "error") {
        return res.json({ check: existingCheck[0] });
      }

      try {
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });

        const searchPrompt = `You are verifying a business registration with the North Carolina Secretary of State (sosnc.gov).

Business Name: "${biz.name}"
Owner Name: "${biz.ownerName || 'Not provided'}"
Location: Currituck County, NC (zip: ${biz.zipCode || '27958'})
Claims LLC: ${biz.hasLLC ? 'Yes' : 'No'}

Based on your knowledge of NC business registrations and common naming patterns, analyze this business:

1. Is "${biz.name}" likely to be found as a registered entity (LLC, Corp, LP, etc.) with the NC Secretary of State?
2. What is the most likely registered name variant? (e.g., "${biz.name} LLC", "${biz.name} Inc")
3. Based on the name and location, does this appear to be a legitimate local business?

Respond in this exact JSON format:
{
  "registrationLikelihood": "high" | "medium" | "low" | "unknown",
  "likelyEntityType": "LLC" | "Corporation" | "Sole Proprietorship" | "Partnership" | "Unknown",
  "likelyRegisteredName": "string",
  "statusAssessment": "likely_active" | "uncertain" | "likely_not_registered",
  "sosSearchUrl": "https://www.sosnc.gov/online_services/search/by_title/_Business_Registration",
  "confidence": "high" | "medium" | "low",
  "notes": "Brief explanation of assessment",
  "flags": ["array of any concerns or notable findings"]
}`;

        const completion = await openai.chat.completions.create({
          model: "gpt-4o",
          messages: [{ role: "user", content: searchPrompt }],
          temperature: 0.2,
          response_format: { type: "json_object" },
        });

        const aiResult = completion.choices[0]?.message?.content || "{}";
        let parsed: any = {};
        try { parsed = JSON.parse(aiResult); } catch { parsed = { error: "Failed to parse AI response" }; }

        const checkStatus = parsed.registrationLikelihood === "high" ? "verified" :
                           parsed.registrationLikelihood === "medium" ? "review_needed" :
                           parsed.registrationLikelihood === "low" ? "not_found" : "review_needed";

        const resultSummary = parsed.statusAssessment === "likely_active" 
          ? `Likely registered as ${parsed.likelyEntityType || "business entity"}` 
          : parsed.statusAssessment === "likely_not_registered" 
            ? "Not likely registered with NC SOS"
            : "Needs manual verification";

        const [check] = await pgDb.insert(businessVerificationChecks).values({
          businessId,
          checkType: "nc_sos",
          status: checkStatus,
          result: resultSummary,
          details: JSON.stringify({
            registrationLikelihood: parsed.registrationLikelihood,
            likelyEntityType: parsed.likelyEntityType,
            likelyRegisteredName: parsed.likelyRegisteredName,
            statusAssessment: parsed.statusAssessment,
            sosSearchUrl: parsed.sosSearchUrl,
            confidence: parsed.confidence,
            notes: parsed.notes,
            flags: parsed.flags,
          }),
          rawResponse: aiResult,
          checkedAt: new Date(),
        }).returning();

        res.json({ check });
      } catch (aiErr) {
        console.error("AI SOS check error:", aiErr);
        const [check] = await pgDb.insert(businessVerificationChecks).values({
          businessId,
          checkType: "nc_sos",
          status: "error",
          result: "AI verification check failed - manual review needed",
          details: JSON.stringify({ error: String(aiErr) }),
          checkedAt: new Date(),
        }).returning();
        res.json({ check });
      }
    } catch (err) {
      console.error("SOS verify error:", err);
      res.status(500).json({ message: "Verification check failed" });
    }
  });

  app.get("/api/businesses/:id/verification", isAuthenticated, async (req: any, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = req.user?.id;

      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.status(401).json({ message: "Not authenticated" });

      const [biz] = await pgDb.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Business not found" });

      if (user.linkedBusinessId !== businessId && user.accountType !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }

      const checks = await pgDb.select().from(businessVerificationChecks)
        .where(eq(businessVerificationChecks.businessId, businessId))
        .orderBy(desc(businessVerificationChecks.checkedAt));

      const docs = await pgDb.select().from(verificationDocuments)
        .where(eq(verificationDocuments.businessId, businessId))
        .orderBy(desc(verificationDocuments.uploadedAt));

      res.json({ checks, documents: docs });
    } catch (err) {
      console.error("Get verification error:", err);
      res.status(500).json({ message: "Failed to get verification info" });
    }
  });

  // Public-safe counter for the homepage urgency banner.
  // Exposes only the founding-member roster size — no PII, no auth.
  //
  // We count any business that has reached a paid state (basic / standard /
  // premium tier OR comp membership OR explicitly flagged is_founding_member),
  // not just rows where `is_founding_member=true`. The flag is only set by the
  // Stripe webhook → processMembershipActivation pipeline, but businesses also
  // become "paid" via comp memberships, admin tier changes, and seed data —
  // none of which flip the flag. Counting by tier reflects what the user
  // actually sees: "X businesses have signed up as founding members".
  // Capped at FOUNDING_LIMIT for the display.
  app.get("/api/public/founding-stats", async (_req, res) => {
    try {
      const FOUNDING_LIMIT = 100;
      const [{ claimed = 0 } = {}] = await pgDb
        .select({ claimed: sql<number>`count(*)::int` })
        .from(businesses)
        .where(sql`(
          ${businesses.membershipTier} IN ('basic', 'standard', 'premium')
          OR ${businesses.isCompedMembership} = true
          OR ${businesses.isFoundingMember} = true
        )`);
      const cappedClaimed = Math.min(claimed as number, FOUNDING_LIMIT);
      res.json({
        limit: FOUNDING_LIMIT,
        claimed: cappedClaimed,
        remaining: Math.max(0, FOUNDING_LIMIT - cappedClaimed),
      });
    } catch (err) {
      console.error("Public founding stats error:", err);
      res.status(500).json({ message: "Failed to load founding stats" });
    }
  });

  // Refer-a-Business + Founding Member status for the dashboard widget.
  // Returns: { referralCode, isFoundingMember, foundingMemberNumber,
  //           goldDaysEarned, referrals: [...] }
  app.get("/api/businesses/:id/referrals", isAuthenticated, async (req: any, res) => {
    try {
      const businessId = parseInt(req.params.id);
      if (!businessId) return res.status(400).json({ message: "Invalid business id" });

      const userId = req.user?.id;
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user) return res.status(401).json({ message: "Not authenticated" });
      if (user.linkedBusinessId !== businessId && user.accountType !== "admin") {
        return res.status(403).json({ message: "Not authorized" });
      }

      const [biz] = await pgDb
        .select({
          id: businesses.id,
          referralCode: businesses.referralCode,
          isFoundingMember: businesses.isFoundingMember,
          foundingMemberNumber: businesses.foundingMemberNumber,
          stripeCustomerId: businesses.stripeCustomerId,
        })
        .from(businesses)
        .where(eq(businesses.id, businessId));
      if (!biz) return res.status(404).json({ message: "Business not found" });

      // Lazy-issue a code if somehow missing
      const code = biz.referralCode ?? (await ensureReferralCode(businessId));

      // Pull current Stripe customer-balance credit so the dashboard can
      // surface "Pending credit: $X" — referral rewards land here as a
      // negative balance that auto-applies to the next invoice. Tolerant
      // of missing Stripe customer (founders/comp accounts) and API
      // failures: degrade silently to 0.
      let pendingCreditCents = 0;
      if (biz.stripeCustomerId) {
        const { stripe } = await import("./stripe");
        if (stripe) {
          const { getPendingCreditCents } = await import("./stripeCreditCache");
          pendingCreditCents = await getPendingCreditCents(biz.stripeCustomerId, stripe);
        }
      }

      const { referrals } = await import("@shared/schema");
      const refs = await pgDb
        .select({
          id: referrals.id,
          referredBusinessId: referrals.referredBusinessId,
          referredName: businesses.name,
          status: referrals.status,
          rewardDays: referrals.rewardDays,
          // Actual Stripe credit issued (cents). Null on legacy rows that
          // pre-date this column and on rows that took the founder/comp
          // Gold-days fallback path. The card displays "$X credit" when
          // present, otherwise falls back to the rewardDays language.
          creditAmountCents: referrals.creditAmountCents,
          createdAt: referrals.createdAt,
          rewardedAt: referrals.rewardedAt,
        })
        .from(referrals)
        .leftJoin(businesses, eq(businesses.id, referrals.referredBusinessId))
        .where(eq(referrals.referrerBusinessId, businessId))
        .orderBy(desc(referrals.createdAt));

      // Sum lifetime credit earned (cents) across rewarded rows. Excludes
      // void rows (admin-cancelled) and legacy rows with NULL cents. This
      // is a separate stat from goldDaysEarned which counts the
      // founder/comp Gold-days fallback path.
      const totalCreditCentsEarned = refs
        .filter((r) => r.status === "rewarded")
        .reduce((sum, r) => sum + (r.creditAmountCents ?? 0), 0);

      const goldDaysEarned = refs
        .filter((r) => r.status === "rewarded")
        .reduce((sum, r) => sum + (r.rewardDays ?? 30), 0);

      res.json({
        referralCode: code,
        isFoundingMember: biz.isFoundingMember,
        foundingMemberNumber: biz.foundingMemberNumber,
        goldDaysEarned,
        totalCreditCentsEarned,
        pendingCreditCents,
        referrals: refs,
      });
    } catch (err) {
      console.error("Get referrals error:", err);
      res.status(500).json({ message: "Failed to get referrals" });
    }
  });

  app.post("/api/businesses/:id/verification-documents", isAuthenticated, async (req: any, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = req.user?.id;

      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user || (user.linkedBusinessId !== businessId && user.accountType !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const { documentType, fileName, fileUrl } = req.body;
      if (!documentType || !fileName || !fileUrl) {
        return res.status(400).json({ message: "documentType, fileName, and fileUrl are required" });
      }

      const validTypes = ["insurance_certificate", "business_license", "contractor_license", "other"];
      if (!validTypes.includes(documentType)) {
        return res.status(400).json({ message: "Invalid document type" });
      }

      if (typeof fileUrl !== "string" || fileUrl.length > 2000) {
        return res.status(400).json({ message: "Invalid file URL" });
      }

      const [doc] = await pgDb.insert(verificationDocuments).values({
        businessId,
        documentType,
        fileName,
        fileUrl,
        status: "pending",
      }).returning();

      res.status(201).json(doc);
    } catch (err) {
      console.error("Upload verification doc error:", err);
      res.status(500).json({ message: "Failed to save verification document" });
    }
  });

  app.get("/api/admin/businesses/:id/verification", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const businessId = parseInt(req.params.id);
      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Business not found" });

      const checks = await pgDb.select().from(businessVerificationChecks)
        .where(eq(businessVerificationChecks.businessId, businessId))
        .orderBy(desc(businessVerificationChecks.checkedAt));

      const docs = await pgDb.select().from(verificationDocuments)
        .where(eq(verificationDocuments.businessId, businessId))
        .orderBy(desc(verificationDocuments.uploadedAt));

      res.json({ business: biz, checks, documents: docs });
    } catch (err) {
      console.error("Admin get verification error:", err);
      res.status(500).json({ message: "Failed to get verification info" });
    }
  });

  app.patch("/api/admin/verification-documents/:id", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const docId = parseInt(req.params.id);
      const { status, adminNote } = req.body;

      if (!["approved", "rejected", "pending"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }

      await pgDb.update(verificationDocuments)
        .set({ status, adminNote: adminNote || null, reviewedAt: new Date() })
        .where(eq(verificationDocuments.id, docId));

      res.json({ message: "Document status updated" });
    } catch (err) {
      console.error("Admin update doc error:", err);
      res.status(500).json({ message: "Failed to update document" });
    }
  });

  app.post("/api/businesses/:id/promo-video", isAuthenticated, async (req, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const { videoUrl } = req.body;

      if (!videoUrl || typeof videoUrl !== "string") {
        return res.status(400).json({ message: "Video URL is required" });
      }

      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }

      if (user[0].linkedBusinessId !== businessId) {
        return res.status(403).json({ message: "You are not authorized to manage this business" });
      }

      const [business] = await pgDb.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      if (getEffectiveTier(business) !== "premium") {
        return res.status(403).json({ message: "Promo video uploads are exclusive to Gold tier members" });
      }

      const [updated] = await pgDb
        .update(businesses)
        .set({ promoVideoUrl: videoUrl })
        .where(eq(businesses.id, businessId))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error("Error saving promo video:", err);
      res.status(500).json({ message: "Failed to save promo video" });
    }
  });

  app.delete("/api/businesses/:id/promo-video", isAuthenticated, async (req, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = (req as any).user?.id;

      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0 || user[0].linkedBusinessId !== businessId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const [updated] = await pgDb
        .update(businesses)
        .set({ promoVideoUrl: null })
        .where(eq(businesses.id, businessId))
        .returning();

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to remove promo video" });
    }
  });

  app.patch("/api/businesses/:id", isAuthenticated, async (req, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const user = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user.length || (user[0].linkedBusinessId !== businessId && user[0].accountType !== "admin")) {
        return res.status(403).json({ message: "Not authorized to edit this business" });
      }
      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, businessId));
      if (!biz) return res.status(404).json({ message: "Business not found" });

      const allowedFields = [
        "description", "phone", "email", "websiteUrl", "businessHours",
        "socialMediaUrls", "searchKeywords", "category", "additionalCategories",
        "hasLLC", "hasInsurance", "isLicensed", "isVeteran",
        "servicesResidential", "servicesCommercial", "acceptsQuotes",
        "address", "ownerName", "localOperationDescription", "imageUrl"
      ];
      const updates: any = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }
      if (updates.imageUrl !== undefined) {
        const url = updates.imageUrl;
        if (url !== null && url !== "" && !url.startsWith("/objects/") && !url.startsWith("https://images.unsplash.com/")) {
          return res.status(400).json({ message: "Invalid image URL" });
        }
      }
      if (updates.category !== undefined && (!updates.category || typeof updates.category !== "string")) {
        return res.status(400).json({ message: "Primary category is required" });
      }
      if (updates.additionalCategories !== undefined) {
        const effectiveTier = getEffectiveTier(biz);
        const tierConfig = getMembershipTier(effectiveTier);
        const maxCategories = tierConfig?.limits.maxCategories ?? 4;
        let addCats = Array.isArray(updates.additionalCategories) ? updates.additionalCategories : [];
        const primaryCat = updates.category || biz.category;
        addCats = [...new Set(addCats.filter((c: string) => c && c !== primaryCat))];
        if (1 + addCats.length > maxCategories) {
          addCats = addCats.slice(0, maxCategories - 1);
        }
        updates.additionalCategories = addCats;
      }
      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }
      const [updated] = await pgDb.update(businesses).set(updates).where(eq(businesses.id, businessId)).returning();
      res.json(updated);
    } catch (err) {
      console.error("Error updating business:", err);
      res.status(500).json({ message: "Failed to update business" });
    }
  });

  app.post("/api/businesses/:id/quote-preference", isAuthenticated, async (req, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const { acceptsQuotes } = req.body;

      const business = await pgDb.select().from(businesses).where(eq(businesses.id, businessId));
      if (!business.length) return res.status(404).json({ message: "Business not found" });

      const user = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user.length || (user[0].linkedBusinessId !== businessId && user[0].accountType !== "admin")) {
        return res.status(403).json({ message: "Not authorized" });
      }

      await pgDb.update(businesses).set({ acceptsQuotes: !!acceptsQuotes }).where(eq(businesses.id, businessId));
      res.json({ success: true, acceptsQuotes: !!acceptsQuotes });
    } catch (error) {
      console.error("Error updating quote preference:", error);
      res.status(500).json({ message: "Failed to update quote preference" });
    }
  });

  app.post("/api/quote-requests/:id/opt-out", isAuthenticated, async (req, res) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = (req as any).user?.id;

      const request = await pgDb.select().from(quoteRequests).where(eq(quoteRequests.id, requestId));
      if (!request.length) return res.status(404).json({ message: "Quote request not found" });
      if (request[0].userId !== userId) return res.status(403).json({ message: "Not authorized" });

      await pgDb.update(quoteRequests).set({ customerOptedOut: true, status: "cancelled" }).where(eq(quoteRequests.id, requestId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error opting out of quote request:", error);
      res.status(500).json({ message: "Failed to opt out of quote request" });
    }
  });

  app.post("/api/quotes/:id/withdraw", isAuthenticated, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.id);
      const userId = (req as any).user?.id;

      const quote = await pgDb.select().from(quotes).where(eq(quotes.id, quoteId));
      if (!quote.length) return res.status(404).json({ message: "Quote not found" });
      if (quote[0].userId !== userId) return res.status(403).json({ message: "Not authorized" });

      await pgDb.update(quotes).set({ businessOptedOut: true, status: "withdrawn" }).where(eq(quotes.id, quoteId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error withdrawing quote:", error);
      res.status(500).json({ message: "Failed to withdraw quote" });
    }
  });

  app.get("/api/quotes/:quoteId/messages", isAuthenticated, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.quoteId);
      const userId = (req as any).user?.id;

      const quote = await pgDb.select().from(quotes).where(eq(quotes.id, quoteId));
      if (!quote.length) return res.status(404).json({ message: "Quote not found" });

      const request = await pgDb.select().from(quoteRequests).where(eq(quoteRequests.id, quote[0].requestId));
      if (!request.length) return res.status(404).json({ message: "Request not found" });

      const isCustomer = request[0].userId === userId;
      const isBusiness = quote[0].userId === userId;
      if (!isCustomer && !isBusiness) return res.status(403).json({ message: "Not authorized" });

      const messages = await pgDb
        .select({
          id: quoteMessages.id,
          quoteId: quoteMessages.quoteId,
          senderId: quoteMessages.senderId,
          message: quoteMessages.message,
          createdAt: quoteMessages.createdAt,
          senderFirstName: users.firstName,
          senderLastName: users.lastName,
          senderAccountType: users.accountType,
        })
        .from(quoteMessages)
        .leftJoin(users, eq(quoteMessages.senderId, users.id))
        .where(eq(quoteMessages.quoteId, quoteId))
        .orderBy(asc(quoteMessages.createdAt));

      await pgDb
        .update(quoteMessages)
        .set({ readAt: new Date() })
        .where(and(
          eq(quoteMessages.quoteId, quoteId),
          sql`${quoteMessages.senderId} != ${userId}`,
          sql`${quoteMessages.readAt} IS NULL`
        ));

      res.json(messages);
    } catch (error) {
      console.error("Error fetching quote messages:", error);
      res.status(500).json({ message: "Failed to fetch messages" });
    }
  });

  app.post("/api/quotes/:quoteId/messages", isAuthenticated, async (req, res) => {
    try {
      const quoteId = parseInt(req.params.quoteId);
      const userId = (req as any).user?.id;
      const { message } = req.body;

      if (!message || typeof message !== "string" || message.trim().length === 0) {
        return res.status(400).json({ message: "Message is required" });
      }

      const quote = await pgDb.select().from(quotes).where(eq(quotes.id, quoteId));
      if (!quote.length) return res.status(404).json({ message: "Quote not found" });

      const request = await pgDb.select().from(quoteRequests).where(eq(quoteRequests.id, quote[0].requestId));
      if (!request.length) return res.status(404).json({ message: "Request not found" });

      const isCustomer = request[0].userId === userId;
      const isBusiness = quote[0].userId === userId;
      if (!isCustomer && !isBusiness) return res.status(403).json({ message: "Not authorized" });

      const [newMessage] = await pgDb
        .insert(quoteMessages)
        .values({
          quoteId,
          senderId: userId,
          message: message.trim(),
        })
        .returning();

      res.json(newMessage);
    } catch (error) {
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Failed to send message" });
    }
  });

  app.get("/api/user/message-counts", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length) return res.json({ count: 0 });

      let result;
      if (user[0].accountType === "business") {
        result = await pgDb
          .select({ count: sql<number>`count(*)` })
          .from(quoteMessages)
          .innerJoin(quotes, eq(quoteMessages.quoteId, quotes.id))
          .where(and(
            eq(quotes.userId, userId),
            sql`${quoteMessages.senderId} != ${userId}`,
            sql`${quoteMessages.readAt} IS NULL`
          ));
      } else {
        result = await pgDb
          .select({ count: sql<number>`count(*)` })
          .from(quoteMessages)
          .innerJoin(quotes, eq(quoteMessages.quoteId, quotes.id))
          .innerJoin(quoteRequests, eq(quotes.requestId, quoteRequests.id))
          .where(and(
            eq(quoteRequests.userId, userId),
            sql`${quoteMessages.senderId} != ${userId}`,
            sql`${quoteMessages.readAt} IS NULL`
          ));
      }

      const quoteCount = Number(result[0]?.count || 0);
      res.json({ count: quoteCount });
    } catch (error) {
      console.error("Error fetching message count:", error);
      res.json({ count: 0, quoteCount: 0, dmCount: 0 });
    }
  });

  // ============ QUOTE MESSAGING INBOX ============

  app.get("/api/messages/inbox", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;

      const quoteThreads = await pgDb.execute(sql`
        SELECT 
          'quote' as type,
          qm."quote_id" as "threadId",
          qr.title as subject,
          qm.message as "lastMessage",
          qm."created_at" as "lastMessageAt",
          qm."sender_id" as "lastSenderId",
          CASE 
            WHEN q."user_id" = ${userId} THEN qr."user_id"
            ELSE q."user_id"
          END as "otherUserId",
          (SELECT COUNT(*) FROM quote_messages sub 
           WHERE sub."quote_id" = qm."quote_id" 
           AND sub."sender_id" != ${userId} 
           AND sub."read_at" IS NULL) as "unreadCount"
        FROM quote_messages qm
        INNER JOIN quotes q ON qm."quote_id" = q.id
        INNER JOIN quote_requests qr ON q."request_id" = qr.id
        WHERE (q."user_id" = ${userId} OR qr."user_id" = ${userId})
        AND qm.id = (
          SELECT id FROM quote_messages sub2 
          WHERE sub2."quote_id" = qm."quote_id" 
          ORDER BY sub2."created_at" DESC LIMIT 1
        )
        ORDER BY qm."created_at" DESC
      `);

      const allThreads = quoteThreads.rows || [];

      const otherUserIds = [...new Set(allThreads.map((t: any) => t.otherUserId))].filter(Boolean);
      let userMap: Record<string, any> = {};
      if (otherUserIds.length > 0) {
        const otherUsers = await pgDb
          .select({
            id: users.id,
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            accountType: users.accountType,
            linkedBusinessId: users.linkedBusinessId,
          })
          .from(users)
          .where(inArray(users.id, otherUserIds as string[]));
        
        for (const u of otherUsers) {
          let businessName = null;
          if (u.linkedBusinessId) {
            const biz = await pgDb.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, u.linkedBusinessId)).limit(1);
            if (biz.length) businessName = biz[0].name;
          }
          userMap[u.id] = { ...u, businessName };
        }
      }

      const enriched = allThreads.map((t: any) => ({
        ...t,
        otherUser: userMap[t.otherUserId] || null,
        unreadCount: Number(t.unreadCount || 0),
      }));

      res.json(enriched);
    } catch (error) {
      console.error("Error fetching inbox:", error);
      res.status(500).json({ message: "Failed to fetch inbox" });
    }
  });

  // ============ ADMIN SUBMISSIONS (Contact Admin) ============

  app.post("/api/admin-submissions", async (req, res) => {
    try {
      const userId = (req as any).user?.id || null;
      const { name, email, subject, message } = req.body;

      if (!name || !email || !subject || !message) {
        return res.status(400).json({ message: "All fields are required" });
      }
      if (message.length > 5000) {
        return res.status(400).json({ message: "Message too long (max 5000 characters)" });
      }

      const [submission] = await pgDb.insert(adminSubmissions).values({
        userId,
        name: name.trim(),
        email: email.trim(),
        subject: subject.trim(),
        message: message.trim(),
      }).returning();

      res.json(submission);
    } catch (error) {
      console.error("Error creating admin submission:", error);
      res.status(500).json({ message: "Failed to submit" });
    }
  });

  app.get("/api/admin/submissions", isAuthenticated, async (req, res) => {
    try {
      const adminId = (req as any).user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const results = await pgDb
        .select()
        .from(adminSubmissions)
        .orderBy(desc(adminSubmissions.createdAt));
      res.json(results);
    } catch (error) {
      console.error("Error fetching admin submissions:", error);
      res.status(500).json({ message: "Failed to fetch submissions" });
    }
  });

  app.patch("/api/admin/submissions/:id", isAuthenticated, async (req, res) => {
    try {
      const adminId = (req as any).user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const id = parseInt(req.params.id);
      const { status, adminNote } = req.body;

      const updates: any = {};
      if (status) updates.status = status;
      if (adminNote !== undefined) updates.adminNote = adminNote;
      if (status === "resolved") updates.resolvedAt = new Date();

      const [updated] = await pgDb
        .update(adminSubmissions)
        .set(updates)
        .where(eq(adminSubmissions.id, id))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Error updating admin submission:", error);
      res.status(500).json({ message: "Failed to update submission" });
    }
  });

  app.get("/api/user/membership-expiration", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length || !user[0].linkedBusinessId) {
        return res.json({ expiring: false });
      }

      const biz = await pgDb
        .select()
        .from(businesses)
        .where(eq(businesses.id, user[0].linkedBusinessId))
        .limit(1);

      if (!biz.length || !biz[0].membershipEndDate) {
        return res.json({ expiring: false });
      }

      const endDate = new Date(biz[0].membershipEndDate);
      const now = new Date();
      const daysLeft = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysLeft <= 7 && daysLeft > 0) {
        const tierMap: Record<string, string> = { basic: "Bronze", standard: "Silver", premium: "Gold" };
        return res.json({
          expiring: true,
          daysLeft,
          endDate: endDate.toISOString(),
          currentTier: tierMap[biz[0].membershipTier || ""] || biz[0].membershipTier,
        });
      }

      if (daysLeft <= 0) {
        return res.json({
          expiring: true,
          daysLeft: 0,
          endDate: endDate.toISOString(),
          expired: true,
          currentTier: biz[0].membershipTier,
        });
      }

      res.json({ expiring: false });
    } catch (error) {
      console.error("Error checking membership expiration:", error);
      res.json({ expiring: false });
    }
  });

  app.post("/api/businesses/:id/logo", isAuthenticated, async (req, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const { logoUrl } = req.body;

      if (!logoUrl || typeof logoUrl !== "string") {
        return res.status(400).json({ message: "Logo URL is required" });
      }

      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0 || user[0].linkedBusinessId !== businessId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const [updated] = await pgDb
        .update(businesses)
        .set({ logoUrl })
        .where(eq(businesses.id, businessId))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error("Error saving logo:", err);
      res.status(500).json({ message: "Failed to save logo" });
    }
  });

  app.delete("/api/businesses/:id/logo", isAuthenticated, async (req, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = (req as any).user?.id;

      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0 || user[0].linkedBusinessId !== businessId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const [updated] = await pgDb
        .update(businesses)
        .set({ logoUrl: null })
        .where(eq(businesses.id, businessId))
        .returning();

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to remove logo" });
    }
  });

  app.post("/api/businesses/:id/gallery", isAuthenticated, async (req, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const { photoUrl } = req.body;

      if (!photoUrl || typeof photoUrl !== "string") {
        return res.status(400).json({ message: "Photo URL is required" });
      }

      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0 || user[0].linkedBusinessId !== businessId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const [business] = await pgDb.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      const tier = getEffectiveTier(business);
      if (tier === "none" || tier === "basic") {
        return res.status(403).json({ message: "Gallery photos require Silver or Gold membership" });
      }

      const maxPhotos = tier === "premium" ? 10 : 6;
      const currentPhotos = business.galleryPhotos || [];

      if (currentPhotos.length >= maxPhotos) {
        return res.status(400).json({ message: `You've reached the maximum of ${maxPhotos} gallery photos for your tier` });
      }

      const [updated] = await pgDb
        .update(businesses)
        .set({ galleryPhotos: [...currentPhotos, photoUrl] })
        .where(eq(businesses.id, businessId))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error("Error adding gallery photo:", err);
      res.status(500).json({ message: "Failed to add gallery photo" });
    }
  });

  app.delete("/api/businesses/:id/gallery", isAuthenticated, async (req, res) => {
    try {
      const businessId = parseInt(req.params.id);
      const userId = (req as any).user?.id;
      const { photoUrl } = req.body;

      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0 || user[0].linkedBusinessId !== businessId) {
        return res.status(403).json({ message: "Not authorized" });
      }

      const [business] = await pgDb.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
      if (!business) {
        return res.status(404).json({ message: "Business not found" });
      }

      const currentPhotos = business.galleryPhotos || [];
      const updatedPhotos = currentPhotos.filter((p: string) => p !== photoUrl);

      const [updated] = await pgDb
        .update(businesses)
        .set({ galleryPhotos: updatedPhotos })
        .where(eq(businesses.id, businessId))
        .returning();

      res.json(updated);
    } catch (err) {
      res.status(500).json({ message: "Failed to remove gallery photo" });
    }
  });

  // Events
  app.get(api.events.list.path, async (req, res) => {
    const { zipCode } = req.query;
    const allEvents = await storage.getEvents();
    const now = new Date();
    const approvedEvents = allEvents.filter(e => {
      if (e.status !== "approved" || (e.paymentStatus !== "paid" && !e.isExample)) return false;
      if (e.displayStartDate) {
        const displayStart = new Date(e.displayStartDate);
        const eventDay = new Date(e.date);
        eventDay.setHours(23, 59, 59, 999);
        return now >= displayStart && now <= eventDay;
      }
      return true;
    });
    const eventsWithTier = await Promise.all(
      approvedEvents.map(async (event) => {
        let businessMembershipTier: string | null = null;
        if (event.businessId) {
          const [biz] = await pgDb.select({ membershipTier: businesses.membershipTier })
            .from(businesses).where(eq(businesses.id, event.businessId)).limit(1);
          if (biz) businessMembershipTier = biz.membershipTier;
        }
        return { ...event, businessMembershipTier };
      })
    );
    if (zipCode && typeof zipCode === "string") {
      const filtered = eventsWithTier.filter(event => {
        if (event.zipCode === zipCode) return true;
        if (event.targetZipCodes && event.targetZipCodes.includes(zipCode)) return true;
        return false;
      });
      return res.json(filtered);
    }
    res.json(eventsWithTier);
  });

  app.post(api.events.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);

      if (!user.length) {
        return res.status(403).json({ message: "User not found." });
      }

      const isAdmin = user[0].accountType === "admin";

      if (!isAdmin && user[0].accountType !== "business") {
        return res.status(403).json({ message: "Only business accounts can create events." });
      }

      if (!isAdmin && !user[0].linkedBusinessId) {
        return res.status(403).json({ message: "You must have a linked business to create events." });
      }
      
      const serverBusinessId = user[0].linkedBusinessId;
      let businessZipCode = "27958";
      
      if (serverBusinessId) {
        const [biz] = await pgDb.select({ zipCode: businesses.zipCode, membershipTier: businesses.membershipTier })
          .from(businesses).where(eq(businesses.id, serverBusinessId)).limit(1);
        if (biz) {
          businessZipCode = biz.zipCode;
        }
      }

      const { businessId: _clientBusinessId, targetZipCodes: _clientTargetZips, adDuration: _adDuration, adSize: clientAdSize, eventDates: clientEventDates, ...bodyWithoutMeta } = req.body;

      const adSizeVal = clientAdSize || "large";
      const adDurationVal = _adDuration || "monthly";

      const sanitizedBody = {
        ...bodyWithoutMeta,
        description: bodyWithoutMeta.description || "",
        imageUrl: bodyWithoutMeta.imageUrl || undefined,
        flyerUrl: bodyWithoutMeta.flyerUrl || undefined,
        adSize: isAdmin ? "large" : adSizeVal,
      };

      const eventZipCode = req.body.zipCode || businessZipCode || "27958";

      const eventDate = new Date(req.body.date);
      const displayDays = adDurationVal === "2week" ? 15 : 31;
      const displayStartDate = new Date(eventDate);
      displayStartDate.setDate(displayStartDate.getDate() - displayDays);

      const eventDatesArray = [eventDate.toISOString()];

      const input = api.events.create.input.parse({
          ...sanitizedBody,
          businessId: serverBusinessId || undefined,
          date: eventDate,
          eventDates: eventDatesArray,
          zipCode: eventZipCode,
          city: req.body.city || "Moyock",
          state: req.body.state || "NC",
          targetZipCodes: [eventZipCode],
      });
      const event = await storage.createEvent(input);

      await pgDb.update(events).set({
        adDuration: isAdmin ? "monthly" : adDurationVal,
        displayStartDate: displayStartDate,
      }).where(eq(events.id, event.id));

      if (isAdmin) {
        await pgDb.update(events).set({ status: "approved", paymentStatus: "paid" }).where(eq(events.id, event.id));
        return res.status(201).json({ ...event, status: "approved", paymentStatus: "paid" });
      }

      const eventAdSize = (clientAdSize || "small") as "small" | "medium" | "large";
      // Use the canonical event ad rates from shared/config/membership.ts
      // (non-member dollar amounts × 100 → cents). Tier discount applied below.
      const eventRates = adDurationVal === "2week" ? EVENT_2WEEK_AD_RATES : EVENT_MONTHLY_AD_RATES;
      const basePriceCents = (eventRates[eventAdSize]?.nonMember ?? eventRates.small.nonMember) * 100;

      const tierDiscounts: Record<string, number> = { basic: 0.10, standard: 0.25, premium: 0.50 };
      let bizTier = "none";
      let isFounderBypass = false;
      if (serverBusinessId) {
        const [bizData] = await pgDb.select({ name: businesses.name, membershipTier: businesses.membershipTier, goldTrialEndDate: businesses.goldTrialEndDate, isCompedMembership: businesses.isCompedMembership, compedMembershipExpiresAt: businesses.compedMembershipExpiresAt })
          .from(businesses).where(eq(businesses.id, serverBusinessId)).limit(1);
        // Founders/admins get full Gold-tier event-ad privileges on every
        // listing they own, even non-primary zip listings.
        isFounderBypass = shouldBypassCharges(user[0], bizData);
        bizTier = isFounderBypass ? "premium" : (bizData ? getEffectiveTier(bizData) : "none");
      }
      const discount = tierDiscounts[bizTier] || 0;
      const finalPriceCents = isFounderBypass ? 0 : Math.round(basePriceCents * (1 - discount));

      await pgDb.update(events).set({ priceCharged: finalPriceCents }).where(eq(events.id, event.id));

      if (serverBusinessId) {
        const [bizInfo] = await pgDb.select({ name: businesses.name })
          .from(businesses).where(eq(businesses.id, serverBusinessId)).limit(1);
        notifyAdminNewEvent(event.title, bizInfo?.name || "Unknown", finalPriceCents).catch(() => {});
      }

      res.status(201).json({ ...event, priceCharged: finalPriceCents });
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  });

  // Posts
  app.get(api.posts.list.path, async (req, res) => {
    const posts = await storage.getPosts();
    res.json(posts);
  });

  app.post(api.posts.create.path, isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0 || (!user[0].isValidated && user[0].accountType !== "admin")) {
        return res.status(403).json({ 
          message: "You must verify your account by uploading a receipt before posting. Visit your dashboard to verify." 
        });
      }
      
      const input = api.posts.create.input.parse(req.body);
      const post = await storage.createPost({
        ...input,
        authorId: userId,
      });
      res.status(201).json(post);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  });

  app.post(api.posts.like.path, isAuthenticated, async (req, res) => {
      const postId = Number(req.params.id);
      const likes = await storage.likePost(postId);
      res.json({ likes });
  });

  // Comments on posts - only verified members can comment
  app.get("/api/posts/:id/comments", async (req, res) => {
    const postId = Number(req.params.id);
    const comments = await pgDb.query.comments.findMany({
      where: eq(commentsTable.postId, postId),
      with: { author: true },
      orderBy: desc(commentsTable.createdAt),
    });
    res.json(comments);
  });

  app.post("/api/posts/:id/comments", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      const postId = Number(req.params.id);
      
      // Check if user is validated before allowing comment
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0 || !user[0].isValidated) {
        return res.status(403).json({ 
          message: "You must verify your account before commenting. Visit your dashboard to verify." 
        });
      }
      
      const { content } = req.body;
      if (!content || content.trim().length === 0) {
        return res.status(400).json({ message: "Comment content is required" });
      }
      
      // Create comment
      const [newComment] = await pgDb.insert(commentsTable).values({
        postId,
        authorId: userId,
        content: content.trim(),
      }).returning();
      
      // Update post comment count
      await pgDb.update(postsTable).set({
        commentCount: sql`${postsTable.commentCount} + 1`
      }).where(eq(postsTable.id, postId));
      
      // Update user comment count
      await pgDb.update(users).set({
        commentCount: sql`${users.commentCount} + 1`
      }).where(eq(users.id, userId));
      
      // Check and update engagement badge
      const updatedUser = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (updatedUser.length > 0) {
        const u = updatedUser[0];
        const totalComments = u.commentCount || 0;
        const totalPosts = u.postCount || 0;
        let newBadge = u.engagementBadge;
        
        // Badge logic based on activity
        if (totalComments >= 50 || totalPosts >= 20) {
          newBadge = "top_contributor";
        } else if (totalPosts >= 10) {
          newBadge = "conversation_starter";
        } else if (totalComments >= 20 || totalPosts >= 5) {
          newBadge = "rising_star";
        } else if (totalComments >= 5) {
          newBadge = "helpful_neighbor";
        }
        
        if (newBadge !== u.engagementBadge) {
          await pgDb.update(users).set({ engagementBadge: newBadge }).where(eq(users.id, userId));
        }
      }
      
      // Fetch comment with author for response
      const commentWithAuthor = await pgDb.query.comments.findFirst({
        where: eq(commentsTable.id, newComment.id),
        with: { author: true },
      });
      
      res.status(201).json(commentWithAuthor);
    } catch (err) {
      console.error("Error creating comment:", err);
      res.status(500).json({ message: "Failed to create comment" });
    }
  });

  // Reviews
  app.get("/api/reviews/recent", async (_req, res) => {
    try {
      const recentReviews = await storage.getRecentReviews(10);
      res.json(recentReviews);
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch recent reviews" });
    }
  });

  app.post(api.reviews.create.path, isAuthenticated, async (req, res) => {
    try {
      const businessId = Number(req.params.id);
      const parsed = api.reviews.create.input.parse(req.body);
      const { reviewRequestToken, ...input } = parsed;
      const reviewUserId = (req as any).user?.id;
      const verificationStatus = input.receiptUrl ? "proof_submitted" : "unverified";
      const review = await storage.createReview({
        ...input,
        userId: reviewUserId,
        businessId: businessId,
        verificationStatus,
      });
      // Funnel linking: if this submission came from a tracked outreach
      // link, mark the originating review_request row as completed and
      // attach the new review id. Best-effort — never block the response
      // on bookkeeping. Scoped to the same businessId so a leaked token
      // can't tag an unrelated business's outreach.
      if (reviewRequestToken) {
        try {
          const { reviewRequests } = await import("@shared/schema");
          const { db: pgDb } = await import("./db");
          const { eq, and } = await import("drizzle-orm");
          await pgDb
            .update(reviewRequests)
            .set({ status: "completed", completedReviewId: review.id })
            .where(
              and(
                eq(reviewRequests.token, reviewRequestToken),
                eq(reviewRequests.businessId, businessId),
              ),
            );
        } catch (linkErr) {
          console.error("[reviews] failed to link review_request:", (linkErr as Error)?.message);
        }
      }
      res.status(201).json(review);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  });

  app.post("/api/reviews/:reviewId/verify", isAuthenticated, async (req: any, res) => {
    try {
      const reviewId = Number(req.params.reviewId);
      const { status } = req.body;
      if (!["business_confirmed", "business_disputed"].includes(status)) {
        return res.status(400).json({ message: "Invalid verification status" });
      }
      const [review] = await pgDb.select().from(reviews).where(eq(reviews.id, reviewId));
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }
      const userId = req.user?.id;
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      const isAdmin = user?.accountType === "admin";
      const isOwner = user?.linkedBusinessId === review.businessId;
      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "Only the business owner or admin can verify reviews" });
      }
      await pgDb.update(reviews).set({ verificationStatus: status }).where(eq(reviews.id, reviewId));
      res.json({ success: true, verificationStatus: status });
    } catch (err) {
      console.error("Review verification error:", err);
      res.status(500).json({ message: "Failed to update review verification" });
    }
  });

  app.post("/api/reviews/:reviewId/owner-response", isAuthenticated, async (req: any, res) => {
    try {
      const reviewId = Number(req.params.reviewId);
      const { response } = req.body;
      if (!response || typeof response !== "string" || response.trim().length === 0) {
        return res.status(400).json({ message: "Response text is required" });
      }
      if (response.length > 1000) {
        return res.status(400).json({ message: "Response must be under 1000 characters" });
      }
      const [review] = await pgDb.select().from(reviews).where(eq(reviews.id, reviewId));
      if (!review) {
        return res.status(404).json({ message: "Review not found" });
      }
      const userId = req.user?.id;
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user) {
        return res.status(401).json({ message: "Unauthorized" });
      }
      if (user.linkedBusinessId !== review.businessId && user.accountType !== "admin") {
        return res.status(403).json({ message: "You can only respond to reviews for your own business" });
      }
      if (review.ownerResponse) {
        return res.status(400).json({ message: "A response has already been submitted for this review" });
      }
      const [updated] = await pgDb.update(reviews)
        .set({ ownerResponse: response.trim(), ownerResponseDate: new Date() })
        .where(eq(reviews.id, reviewId))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error("Owner response error:", err);
      res.status(500).json({ message: "Failed to submit response" });
    }
  });

  // Reset categories (for updating)
  app.post('/api/categories/reset', async (req, res) => {
    try {
      await db.delete('categories');
      res.json({ message: 'Categories cleared. Restart to reseed.' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to reset categories' });
    }
  });

  // Categories API (from Replit KV database)
  app.get('/api/categories', async (req, res) => {
    try {
      const result = await db.get('categories');
      // Replit DB returns { ok: true, value: [...] } or { ok: false, error: {...} }
      if (result && result.ok && result.value) {
        res.json(result.value);
      } else if (Array.isArray(result)) {
        res.json(result);
      } else {
        res.json([]);
      }
    } catch (error) {
      console.error('Failed to fetch categories:', error);
      res.status(500).json({ message: 'Failed to fetch categories' });
    }
  });

  // Weather API (using Open-Meteo - free, no API key needed)
  app.get('/api/weather', async (req, res) => {
    try {
      const response = await fetch(
        'https://api.open-meteo.com/v1/forecast?latitude=35.9575&longitude=-75.6243&current_weather=true&temperature_unit=fahrenheit'
      );
      const data = await response.json();
      res.json(data);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch weather data' });
    }
  });


  // ============ ACCOUNT TYPE & VALIDATION ============
  
  // Update account type
  app.post("/api/user/account-type", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { accountType } = req.body;
      if (!accountType || !["customer", "business"].includes(accountType)) {
        return res.status(400).json({ message: "Invalid account type" });
      }
      
      await pgDb.update(users)
        .set({ accountType, updatedAt: new Date() })
        .where(eq(users.id, userId));
      
      res.json({ message: "Account type updated", accountType });
    } catch (err) {
      console.error("Error updating account type:", err);
      res.status(500).json({ message: "Failed to update account type" });
    }
  });

  // ============ QUOTE REQUEST SYSTEM ============
  
  // Get all open quote requests (for businesses)
  app.get("/api/quotes/requests", async (req, res) => {
    try {
      const category = req.query.category as string | undefined;
      
      // Check if user is authenticated and is a business account
      const currentUserId = (req as any).user?.id;
      let currentUser = null;
      let linkedBusinessId: number | null = null;
      if (currentUserId) {
        const userResult = await pgDb.select().from(users).where(eq(users.id, currentUserId)).limit(1);
        currentUser = userResult[0] || null;
        linkedBusinessId = currentUser?.linkedBusinessId || null;
      }
      const isBusinessUser = currentUser?.accountType === "business";
      
      // Process expired priority assignments before returning results
      await processExpiredPriorityAssignments();
      
      // Get all open requests with customer info
      const requests = await pgDb.select().from(quoteRequests)
        .where(eq(quoteRequests.status, "open"))
        .orderBy(desc(quoteRequests.createdAt));
      
      // Enrich with customer info, quote counts, and priority/tier-based access
      const enrichedRequests = await Promise.all(requests.map(async (request) => {
        let hasPriorityAccess = false;
        let priorityExpiresAt: Date | null = null;
        let accessRound: string | null = null;
        
        if (isBusinessUser && linkedBusinessId) {
          const [linkedBusiness] = await pgDb.select({ membershipTier: businesses.membershipTier, goldTrialEndDate: businesses.goldTrialEndDate, isCompedMembership: businesses.isCompedMembership, compedMembershipExpiresAt: businesses.compedMembershipExpiresAt })
            .from(businesses).where(eq(businesses.id, linkedBusinessId)).limit(1);
          
          const bizTier = linkedBusiness ? getEffectiveTier(linkedBusiness) : "none";
          const tierAccess = getTierAccessForRequest(request.createdAt || new Date());
          
          if (bizTier === "premium" && tierAccess.gold) {
            hasPriorityAccess = true;
            accessRound = "1st Round (Gold)";
            priorityExpiresAt = new Date((request.createdAt || new Date()).getTime() + GOLD_ACCESS_WINDOW_HOURS * 60 * 60 * 1000);
          } else if (bizTier === "standard" && tierAccess.silver) {
            hasPriorityAccess = true;
            accessRound = "2nd Round (Silver)";
            priorityExpiresAt = new Date((request.createdAt || new Date()).getTime() + SILVER_ACCESS_END_HOURS * 60 * 60 * 1000);
          } else if (bizTier === "basic" && tierAccess.bronze) {
            hasPriorityAccess = true;
            accessRound = "3rd Round (Bronze)";
          }
        }
        
        // Only include customer info for business users (privacy protection)
        let customerInfo = null;
        let customerContact = null;
        
        if (isBusinessUser || currentUserId === request.userId) {
          const customerResult = await pgDb.select({
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            customerRating: users.customerRating,
            projectsCompleted: users.projectsCompleted,
            totalSpent: users.totalSpent
          }).from(users).where(eq(users.id, request.userId)).limit(1);
          customerInfo = customerResult[0] || null;
          
          // Contact info is no longer exposed - businesses must communicate through platform messaging
        }
        
        // Get quote count for this request
        const quoteCount = await pgDb.select({ count: quotes.id }).from(quotes)
          .where(eq(quotes.requestId, request.id));
        
        // Get lowest quote amount
        const allQuotes = await pgDb.select({ amount: quotes.amount }).from(quotes)
          .where(eq(quotes.requestId, request.id));
        const pricedQuotes = allQuotes.filter(q => Number(q.amount) > 0);
        const lowestQuote = pricedQuotes.length > 0 
          ? Math.min(...pricedQuotes.map(q => Number(q.amount)))
          : null;
        
        // Calculate response window info
        const isEmergency = request.isEmergency || false;
        const responseWindowHours = getResponseWindowHours(request.category);
        
        return {
          ...request,
          customer: customerInfo,
          customerContact: null,
          quoteCount: quoteCount.length,
          lowestQuote,
          hasPriorityAccess,
          priorityExpiresAt,
          accessRound,
          isEmergency,
          responseWindowHours
        };
      }));
      
      res.json(enrichedRequests);
    } catch (err) {
      console.error("Error fetching quote requests:", err);
      res.status(500).json({ message: "Failed to fetch quote requests" });
    }
  });

  // Get user's own quote requests
  app.get("/api/user/quote-requests", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const requests = await pgDb.select().from(quoteRequests)
        .where(eq(quoteRequests.userId, userId))
        .orderBy(desc(quoteRequests.createdAt));
      
      res.json(requests);
    } catch (err) {
      console.error("Error fetching user quote requests:", err);
      res.status(500).json({ message: "Failed to fetch quote requests" });
    }
  });

  // Create a quote request (customer only)
  app.post("/api/quotes/requests", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Verify user is a customer (not a business)
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length > 0 && user[0].accountType === "business") {
        return res.status(403).json({ message: "Business accounts cannot create quote requests" });
      }
      
      const { title, description, category, budget, timeline, location, address, phone, email, customerName, maxQuotes } = req.body;
      if (!title || !description || !category) {
        return res.status(400).json({ message: "Title, description, and category are required" });
      }
      
      let validMaxQuotes: number | null = null;
      if (maxQuotes !== null && maxQuotes !== undefined && maxQuotes !== "" && maxQuotes !== "unlimited") {
        const parsed = Number(maxQuotes);
        if (![5, 10].includes(parsed) || !Number.isInteger(parsed)) {
          return res.status(400).json({ message: "Max quotes must be 5, 10, or unlimited" });
        }
        validMaxQuotes = parsed;
      }
      
      // Check if this is an emergency category
      const isEmergency = EMERGENCY_CATEGORIES.some(cat => 
        category.toLowerCase().includes(cat.toLowerCase())
      );
      
      // Calculate priority expiry for this request
      const priorityExpiresAt = calculatePriorityExpiry(category);
      
      const [newRequest] = await pgDb.insert(quoteRequests).values({
        userId,
        title,
        description,
        category,
        budget,
        timeline,
        location,
        address: address || null,
        status: "open",
        isEmergency,
        maxQuotes: validMaxQuotes,
        receivedQuotesCount: 0,
        customerName: customerName || null,
        customerPhone: phone || null,
        customerEmail: email || user[0]?.email || null,
        priorityRound: 1,
        priorityExpiresAt,
        expiresAt: calculateQuoteExpiration(new Date()),
      }).returning();
      
      // Assign priority to top premium businesses
      if (user.length > 0) {
        const customerRating = Number(user[0].customerRating) || 5.0;
        await assignPriorityToPremiumBusinesses(newRequest.id, category, customerRating, 1);
      }
      
      res.status(201).json(newRequest);
    } catch (err) {
      console.error("Error creating quote request:", err);
      res.status(500).json({ message: "Failed to create quote request" });
    }
  });

  // Get quotes for a specific request
  app.get("/api/quotes/requests/:requestId/quotes", isAuthenticated, async (req, res) => {
    try {
      const requestId = Number(req.params.requestId);
      const userId = (req as any).user?.id;

      const request = await pgDb.select().from(quoteRequests).where(eq(quoteRequests.id, requestId)).limit(1);
      if (!request.length) return res.status(404).json({ message: "Request not found" });

      const userRecord = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      const isRequestOwner = request[0].userId === userId;
      const isAdmin = userRecord[0]?.accountType === "admin";
      const isBusiness = userRecord[0]?.accountType === "business";

      if (!isRequestOwner && !isAdmin && !isBusiness) {
        return res.status(403).json({ message: "Not authorized to view quotes" });
      }
      
      let requestQuotes;
      if (isBusiness && !isRequestOwner && !isAdmin) {
        const businessRecord = await pgDb.select().from(businesses)
          .where(eq(businesses.id, userRecord[0].linkedBusinessId!)).limit(1);
        const businessId = businessRecord[0]?.id;
        requestQuotes = businessId ? await pgDb.select().from(quotes)
          .where(and(eq(quotes.requestId, requestId), eq(quotes.businessId, businessId), eq(quotes.businessOptedOut, false)))
          .orderBy(quotes.amount) : [];
      } else {
        requestQuotes = await pgDb.select().from(quotes)
          .where(and(eq(quotes.requestId, requestId), eq(quotes.businessOptedOut, false)))
          .orderBy(quotes.amount);
      }
      
      const enrichedQuotes = await Promise.all(requestQuotes.map(async (quote) => {
        const businessInfo = await pgDb.select({
          id: businesses.id,
          name: businesses.name,
          imageUrl: businesses.imageUrl,
          category: businesses.category,
          verified: businesses.verified
        }).from(businesses).where(eq(businesses.id, quote.businessId)).limit(1);
        
        return {
          ...quote,
          business: businessInfo[0] || null
        };
      }));
      
      res.json(enrichedQuotes);
    } catch (err) {
      console.error("Error fetching quotes:", err);
      res.status(500).json({ message: "Failed to fetch quotes" });
    }
  });

  // Submit a quote/bid (business accounts only)
  app.post("/api/quotes/requests/:requestId/quotes", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Verify user is a business account
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user[0].accountType !== "business") {
        return res.status(403).json({ message: "Only business accounts can submit quotes" });
      }
      
      const requestId = Number(req.params.requestId);
      const { amount, message, estimatedDuration, businessId } = req.body;
      
      if (!message) {
        return res.status(400).json({ message: "A message is required" });
      }
      
      // Use linked business ID if not provided, or validate ownership
      const effectiveBusinessId = businessId || user[0].linkedBusinessId;
      if (!effectiveBusinessId) {
        return res.status(400).json({ message: "No business linked to your account. Please set up your business first." });
      }
      
      // Check if request exists and is open
      const request = await pgDb.select().from(quoteRequests)
        .where(eq(quoteRequests.id, requestId)).limit(1);
      
      if (request.length === 0) {
        return res.status(404).json({ message: "Quote request not found" });
      }
      
      if (request[0].status !== "open") {
        return res.status(400).json({ message: "This quote request is no longer accepting bids" });
      }
      
      if (request[0].maxQuotes && (request[0].receivedQuotesCount || 0) >= request[0].maxQuotes) {
        return res.status(400).json({ message: "This quote request has reached the maximum number of quotes requested by the customer." });
      }
      
      const existingQuote = await pgDb.select({ id: quotes.id }).from(quotes)
        .where(and(eq(quotes.requestId, requestId), eq(quotes.businessId, effectiveBusinessId)))
        .limit(1);
      if (existingQuote.length > 0) {
        return res.status(400).json({ message: "You have already submitted a quote for this request." });
      }
      
      // Enforce tier-based access window
      const business = await pgDb.select({ membershipTier: businesses.membershipTier })
        .from(businesses)
        .where(eq(businesses.id, effectiveBusinessId))
        .limit(1);
      
      if (business.length === 0) {
        return res.status(404).json({ message: "Business not found" });
      }
      
      const businessTier = business[0].membershipTier || "basic";
      const requestCreatedAt = request[0].createdAt ? new Date(request[0].createdAt) : new Date();
      
      if (!doesTierHaveAccess(businessTier, requestCreatedAt)) {
        return res.status(403).json({ 
          message: "This project is not yet available for your membership tier. Upgrade for earlier access to quote requests." 
        });
      }
      
      // Check if this business has a priority assignment for this request
      const priorityAssignment = await pgDb.select()
        .from(quotePriorityAssignments)
        .where(
          and(
            eq(quotePriorityAssignments.requestId, requestId),
            eq(quotePriorityAssignments.businessId, effectiveBusinessId)
          )
        )
        .limit(1);
      
      // Calculate response time and priority status
      let responseTimeMinutes: number | null = null;
      let wasPriorityResponse = false;
      
      if (priorityAssignment.length > 0) {
        const assignment = priorityAssignment[0];
        const assignedAt = assignment.assignedAt || new Date();
        const now = new Date();
        responseTimeMinutes = Math.round((now.getTime() - assignedAt.getTime()) / (1000 * 60));
        
        // Check if response is within priority window
        wasPriorityResponse = now < assignment.expiresAt;
        
        // Get customer rating for metrics update
        const customer = await pgDb.select({ customerRating: users.customerRating })
          .from(users)
          .where(eq(users.id, request[0].userId))
          .limit(1);
        const customerRating = Number(customer[0]?.customerRating) || 5.0;
        
        // Update vendor metrics - pass category for response window calculation
        await updateVendorMetricsOnResponse(
          effectiveBusinessId,
          requestId,
          responseTimeMinutes,
          request[0].category,
          customerRating
        );
      }
      
      const [newQuote] = await pgDb.insert(quotes).values({
        requestId,
        businessId: effectiveBusinessId,
        userId,
        amount: amount ? amount.toString() : "0",
        message,
        estimatedDuration,
        status: "pending",
        responseTimeMinutes,
        wasPriorityResponse
      }).returning();
      
      await pgDb.update(quoteRequests)
        .set({ receivedQuotesCount: sql`COALESCE(${quoteRequests.receivedQuotesCount}, 0) + 1` })
        .where(eq(quoteRequests.id, requestId));
      
      if (request[0].maxQuotes) {
        const [updated] = await pgDb.select({ receivedQuotesCount: quoteRequests.receivedQuotesCount })
          .from(quoteRequests).where(eq(quoteRequests.id, requestId));
        if (updated && (updated.receivedQuotesCount || 0) >= request[0].maxQuotes) {
          await pgDb.update(quoteRequests).set({ status: "completed" }).where(eq(quoteRequests.id, requestId));
        }
      }
      
      res.status(201).json(newQuote);
    } catch (err) {
      console.error("Error submitting quote:", err);
      res.status(500).json({ message: "Failed to submit quote" });
    }
  });

  // Accept a quote (customer)
  app.post("/api/quotes/:quoteId/accept", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const quoteId = Number(req.params.quoteId);
      
      // Get the quote
      const quote = await pgDb.select().from(quotes)
        .where(eq(quotes.id, quoteId)).limit(1);
      
      if (quote.length === 0) {
        return res.status(404).json({ message: "Quote not found" });
      }
      
      // Verify user owns the request
      const request = await pgDb.select().from(quoteRequests)
        .where(eq(quoteRequests.id, quote[0].requestId)).limit(1);
      
      if (request.length === 0 || request[0].userId !== userId) {
        return res.status(403).json({ message: "Not authorized to accept this quote" });
      }
      
      if (request[0].status !== "open") {
        return res.status(400).json({ message: "This request is no longer open for accepting quotes" });
      }
      
      if (quote[0].status !== "pending") {
        return res.status(400).json({ message: "This quote has already been processed" });
      }
      
      // Accept the quote and update request status
      await pgDb.update(quotes)
        .set({ status: "accepted" })
        .where(eq(quotes.id, quoteId));
      
      await pgDb.update(quoteRequests)
        .set({ status: "in_progress" })
        .where(eq(quoteRequests.id, quote[0].requestId));
      
      // Reject other quotes
      await pgDb.update(quotes)
        .set({ status: "rejected" })
        .where(and(
          eq(quotes.requestId, quote[0].requestId),
          eq(quotes.status, "pending")
        ));
      
      res.json({ message: "Quote accepted" });
    } catch (err) {
      console.error("Error accepting quote:", err);
      res.status(500).json({ message: "Failed to accept quote" });
    }
  });

  // Get vendor response metrics ranking
  app.get("/api/vendors/metrics", async (req, res) => {
    try {
      const metrics = await pgDb.select({
        businessId: vendorMetrics.businessId,
        totalAssignments: vendorMetrics.totalAssignments,
        responsesOnTime: vendorMetrics.responsesOnTime,
        responsesLate: vendorMetrics.responsesLate,
        noResponses: vendorMetrics.noResponses,
        averageResponseMinutes: vendorMetrics.averageResponseMinutes,
        responseRating: vendorMetrics.responseRating,
      })
      .from(vendorMetrics)
      .orderBy(desc(vendorMetrics.responseRating));
      
      // Enrich with business info
      const enrichedMetrics = await Promise.all(metrics.map(async (m) => {
        const businessInfo = await pgDb.select({
          name: businesses.name,
          category: businesses.category,
          membershipTier: businesses.membershipTier,
        }).from(businesses).where(eq(businesses.id, m.businessId)).limit(1);
        
        return {
          ...m,
          business: businessInfo[0] || null
        };
      }));
      
      res.json(enrichedMetrics);
    } catch (err) {
      console.error("Error fetching vendor metrics:", err);
      res.status(500).json({ message: "Failed to fetch vendor metrics" });
    }
  });

  app.get("/api/my-business", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      const linkedBusinessId = user[0].linkedBusinessId;
      if (!linkedBusinessId) {
        return res.json(null);
      }
      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, linkedBusinessId)).limit(1);
      if (!biz) {
        return res.json(null);
      }
      res.json({ ...biz, effectiveTier: getEffectiveTier(biz) });
    } catch (err) {
      console.error("Error fetching my business:", err);
      res.status(500).json({ message: "Failed to fetch business" });
    }
  });

  // Get my business's vendor metrics
  app.get("/api/my-business/metrics", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0 || user[0].accountType !== "business") {
        return res.status(403).json({ message: "Only business accounts can access metrics" });
      }
      
      const linkedBusinessId = user[0].linkedBusinessId;
      if (!linkedBusinessId) {
        return res.json(null);
      }
      
      const metrics = await pgDb.select()
        .from(vendorMetrics)
        .where(eq(vendorMetrics.businessId, linkedBusinessId))
        .limit(1);
      
      if (metrics.length === 0) {
        return res.json({
          businessId: linkedBusinessId,
          totalAssignments: 0,
          responsesOnTime: 0,
          responsesLate: 0,
          noResponses: 0,
          averageResponseMinutes: null,
          responseRating: "5.00"
        });
      }
      
      res.json(metrics[0]);
    } catch (err) {
      console.error("Error fetching my business metrics:", err);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  // ============ ADVERTISING ROUTES ============

  // Get ad pricing options (public)
  app.get("/api/ads/pricing", async (req, res) => {
    try {
      const pricing = await pgDb.select().from(adPricing).where(eq(adPricing.isActive, true));
      res.json(pricing);
    } catch (err) {
      console.error("Error fetching ad pricing:", err);
      res.status(500).json({ message: "Failed to fetch ad pricing" });
    }
  });

  // Get active ads for display (public, by placement type)
  app.get("/api/ads/active", async (req, res) => {
    try {
      const { type, category, zipCode } = req.query;
      
      let query = pgDb.select({
        id: adPlacements.id,
        businessId: adPlacements.businessId,
        placementType: adPlacements.placementType,
        title: adPlacements.title,
        description: adPlacements.description,
        imageUrl: adPlacements.imageUrl,
        linkUrl: adPlacements.linkUrl,
        category: adPlacements.category,
        targetZipCodes: adPlacements.targetZipCodes,
        businessName: businesses.name,
        businessImageUrl: businesses.imageUrl,
      }).from(adPlacements)
        .leftJoin(businesses, eq(adPlacements.businessId, businesses.id))
        .where(and(
          eq(adPlacements.status, "active"),
          eq(adPlacements.paymentStatus, "paid"),
          or(
            sql`${adPlacements.endDate} IS NULL`,
            sql`${adPlacements.endDate} > NOW()`
          )
        ));
      
      const results = await query;
      
      let filtered = results;
      if (type && typeof type === "string") {
        filtered = filtered.filter(ad => ad.placementType === type);
      }
      if (category && typeof category === "string") {
        filtered = filtered.filter(ad => !ad.category || ad.category === category);
      }
      if (zipCode && typeof zipCode === "string") {
        filtered = filtered.filter(ad => {
          if (!ad.targetZipCodes || ad.targetZipCodes.length === 0) return true;
          return ad.targetZipCodes.includes(zipCode);
        });
      }
      
      res.json(filtered);
    } catch (err) {
      console.error("Error fetching active ads:", err);
      res.status(500).json({ message: "Failed to fetch ads" });
    }
  });

  // Track ad impression (public)
  app.post("/api/ads/:id/impression", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      if (isNaN(id)) { res.status(400).json({ message: "Invalid ad ID" }); return; }
      await pgDb.execute(`UPDATE ad_placements SET impressions = impressions + 1 WHERE id = ${id}`);
      res.json({ success: true });
    } catch (err) {
      console.error("Error tracking impression:", err);
      res.status(500).json({ message: "Failed to track impression" });
    }
  });

  // Track ad click (public)
  app.post("/api/ads/:id/click", async (req, res) => {
    try {
      const id = parseInt(req.params.id);
      await pgDb.execute(`UPDATE ad_placements SET clicks = clicks + 1 WHERE id = ${id}`);
      res.json({ success: true });
    } catch (err) {
      console.error("Error tracking click:", err);
      res.status(500).json({ message: "Failed to track click" });
    }
  });

  // Get my ads (business account required)
  app.get("/api/ads/my-ads", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.accountType !== "business" || !user.linkedBusinessId) {
        return res.status(403).json({ message: "Business account required" });
      }

      const myAds = await pgDb.select().from(adPlacements)
        .where(eq(adPlacements.businessId, user.linkedBusinessId))
        .orderBy(desc(adPlacements.createdAt));
      
      res.json(myAds);
    } catch (err) {
      console.error("Error fetching my ads:", err);
      res.status(500).json({ message: "Failed to fetch your ads" });
    }
  });

  // Create ad request (business account required)
  app.post("/api/ads/request", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.accountType !== "business" || !user.linkedBusinessId) {
        return res.status(403).json({ message: "Business account required" });
      }

      const { placementType, title, description, imageUrl, videoUrl, linkUrl, category, startDate, adSize, adDuration } = req.body;

      if (!placementType || !title) {
        return res.status(400).json({ message: "Placement type and title are required" });
      }

      const durationDays = 30;
      const adStartDate = startDate ? new Date(startDate) : new Date();
      const adEndDate = new Date(adStartDate);
      adEndDate.setDate(adEndDate.getDate() + durationDays);

      const validSizes = ["small", "medium", "large"];
      const size = validSizes.includes(adSize) ? adSize : "small";

      // Get price from server-side pricing table (don't trust client)
      const [pricing] = await pgDb.select()
        .from(adPricing)
        .where(eq(adPricing.placementType, placementType));
      
      if (!pricing) {
        return res.status(400).json({ message: "Invalid placement type" });
      }

      const [biz] = await pgDb.select({ name: businesses.name, zipCode: businesses.zipCode, membershipTier: businesses.membershipTier, goldTrialEndDate: businesses.goldTrialEndDate, isCompedMembership: businesses.isCompedMembership, compedMembershipExpiresAt: businesses.compedMembershipExpiresAt })
        .from(businesses).where(eq(businesses.id, user.linkedBusinessId)).limit(1);
      const businessZip = biz?.zipCode || "27958";
      // Founders (and admins) bypass tier gating for ad creation — they get
      // full Gold-tier privileges on every listing they own, regardless of
      // which child/zip listing is currently active. Charges are bypassed
      // separately in the Stripe ad-checkout route.
      const isFounderBypass = shouldBypassCharges(user, biz);
      const effectiveTier = isFounderBypass ? "premium" : (biz ? getEffectiveTier(biz) : "none");

      const tierAllowedSizes: Record<string, string[]> = {
        none: ["small"],
        basic: ["small"],
        standard: ["small", "medium"],
        premium: ["small", "medium", "large"],
      };
      const allowed = tierAllowedSizes[effectiveTier] || ["small"];
      if (!allowed.includes(size)) {
        const tierNames: Record<string, string> = { medium: "Silver", large: "Gold" };
        return res.status(403).json({ message: `${tierNames[size] || "Higher"} membership required for ${size} ads` });
      }

      const AD_MONTHLY_PRICING: Record<string, number> = { small: 25000, medium: 50000, large: 100000 };
      const chargedPrice = AD_MONTHLY_PRICING[size] || 25000;

      const tierDiscounts: Record<string, number> = { basic: 0.10, standard: 0.25, premium: 0.50 };
      const discount = tierDiscounts[effectiveTier] || 0;
      const discountedPrice = isFounderBypass ? 0 : Math.round(chargedPrice * (1 - discount));

      let validatedVideoUrl: string | null = null;
      if (videoUrl) {
        const tierVideoLimits: Record<string, number> = { basic: 10, standard: 20, premium: 30 };
        const videoLimit = tierVideoLimits[effectiveTier] || 0;
        if (videoLimit === 0) {
          return res.status(403).json({ message: "Video ads require a membership (Bronze, Silver, or Gold)" });
        }
        validatedVideoUrl = videoUrl;
      }

      let normalizedImageUrl = imageUrl || null;
      if (normalizedImageUrl && !normalizedImageUrl.startsWith("http") && !normalizedImageUrl.startsWith("/objects/")) {
        normalizedImageUrl = `/objects/${normalizedImageUrl}`;
      }

      const [newAd] = await pgDb.insert(adPlacements).values({
        businessId: user.linkedBusinessId,
        placementType,
        adSize: size,
        title,
        description,
        imageUrl: normalizedImageUrl,
        videoUrl: validatedVideoUrl,
        linkUrl: linkUrl && linkUrl.trim() && !linkUrl.startsWith("http") ? `https://${linkUrl}` : linkUrl,
        category,
        startDate: adStartDate,
        endDate: adEndDate,
        pricePerWeek: pricing.pricePerWeek,
        priceMonthly: discountedPrice,
        status: "pending",
        paymentStatus: "unpaid",
        targetZipCodes: [businessZip],
      }).returning();

      res.json(newAd);
    } catch (err) {
      console.error("Error creating ad request:", err);
      res.status(500).json({ message: "Failed to create ad request" });
    }
  });

  app.get("/api/zip-expansion/pricing", (req, res) => {
    const BASE_PRICE_PER_ZIP = 2500; // $25/month in cents
    res.json({
      basePrice: BASE_PRICE_PER_ZIP,
      discounts: {
        none: 0,
        basic: 10,    // Bronze 10% off
        standard: 25, // Silver 25% off
        premium: 50,  // Gold 50% off
      },
    });
  });

  app.patch("/api/ads/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.accountType !== "business" || !user.linkedBusinessId) {
        return res.status(403).json({ message: "Business account required" });
      }
      const adId = parseInt(req.params.id);
      const [ad] = await pgDb.select().from(adPlacements).where(
        and(eq(adPlacements.id, adId), eq(adPlacements.businessId, user.linkedBusinessId))
      );
      if (!ad) return res.status(404).json({ message: "Ad not found" });

      if (ad.status === "denied") {
        return res.status(400).json({ message: "Denied ads cannot be edited. Please create a new ad." });
      }

      const { title, description, imageUrl, videoUrl, linkUrl, adSize } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (imageUrl !== undefined) {
        let normalizedImg = imageUrl || null;
        if (normalizedImg && !normalizedImg.startsWith("http") && !normalizedImg.startsWith("/objects/")) {
          normalizedImg = `/objects/${normalizedImg}`;
        }
        updates.imageUrl = normalizedImg;
      }
      if (videoUrl !== undefined) updates.videoUrl = videoUrl;
      if (linkUrl !== undefined) updates.linkUrl = linkUrl && linkUrl.trim() && !linkUrl.startsWith("http") ? `https://${linkUrl}` : linkUrl;
      if (ad.status === "active" && ad.paymentStatus === "paid" && adSize && adSize !== ad.adSize) {
        return res.status(400).json({ message: "Cannot change ad size while the ad is active. You can update the title, description, image, or link." });
      }
      if (adSize && ["small", "medium", "large"].includes(adSize) && adSize !== ad.adSize) {
        // Tier gating only fires when the size is actually changing — the
        // frontend echoes `adSize` on every edit (including title/description-
        // only edits), so we must NOT block downgraded businesses from
        // editing copy on a previously-grandfathered larger ad.
        const AD_MONTHLY_PRICING: Record<string, number> = { small: 25000, medium: 50000, large: 100000 };
        const [biz] = await pgDb.select({ name: businesses.name, membershipTier: businesses.membershipTier, goldTrialEndDate: businesses.goldTrialEndDate, isCompedMembership: businesses.isCompedMembership, compedMembershipExpiresAt: businesses.compedMembershipExpiresAt })
          .from(businesses).where(eq(businesses.id, user.linkedBusinessId)).limit(1);
        // Founders/admins get full Gold-tier ad-size privileges on every
        // listing they own, even non-primary zip listings.
        const isFounderBypass = shouldBypassCharges(user, biz);
        const adEffectiveTier = isFounderBypass ? "premium" : (biz ? getEffectiveTier(biz) : "none");
        const tierAllowedSizesPatch: Record<string, string[]> = {
          none: ["small"],
          basic: ["small"],
          standard: ["small", "medium"],
          premium: ["small", "medium", "large"],
        };
        const allowedPatch = tierAllowedSizesPatch[adEffectiveTier] || ["small"];
        if (!allowedPatch.includes(adSize)) {
          const tierNames: Record<string, string> = { medium: "Silver", large: "Gold" };
          return res.status(403).json({ message: `${tierNames[adSize] || "Higher"} membership required for ${adSize} ads` });
        }
        updates.adSize = adSize;
        const tierDiscounts: Record<string, number> = { basic: 0.10, standard: 0.25, premium: 0.50 };
        const discount = tierDiscounts[adEffectiveTier] || 0;
        updates.priceMonthly = isFounderBypass ? 0 : Math.round(AD_MONTHLY_PRICING[adSize] * (1 - discount));
        if (ad.adSize !== adSize && ad.paymentStatus === "paid") {
          updates.paymentStatus = "unpaid";
          updates.totalPaid = 0;
          updates.paymentNotes = "Reset: ad size changed after payment";
        }
      }

      const [updated] = await pgDb.update(adPlacements)
        .set(updates)
        .where(eq(adPlacements.id, adId))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error("Error updating ad:", err);
      res.status(500).json({ message: "Failed to update ad" });
    }
  });

  app.delete("/api/ads/:id", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.accountType !== "business" || !user.linkedBusinessId) {
        return res.status(403).json({ message: "Business account required" });
      }
      const adId = parseInt(req.params.id);
      const [ad] = await pgDb.select().from(adPlacements).where(
        and(eq(adPlacements.id, adId), eq(adPlacements.businessId, user.linkedBusinessId))
      );
      if (!ad) return res.status(404).json({ message: "Ad not found" });
      if (ad.status !== "pending") {
        return res.status(400).json({ message: "Only pending ads can be cancelled." });
      }
      await pgDb.delete(adPlacements).where(eq(adPlacements.id, adId));
      res.json({ message: "Ad cancelled successfully" });
    } catch (err) {
      console.error("Error deleting ad:", err);
      res.status(500).json({ message: "Failed to cancel ad" });
    }
  });

  app.post("/api/ads/:id/add-zip-codes", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      if (user.accountType !== "business" || !user.linkedBusinessId) {
        return res.status(403).json({ message: "Business account required" });
      }
      const adId = parseInt(req.params.id);
      const { zipCodes } = req.body;
      if (!Array.isArray(zipCodes) || zipCodes.length === 0) {
        return res.status(400).json({ message: "At least one zip code is required" });
      }
      const [ad] = await pgDb.select().from(adPlacements).where(
        and(eq(adPlacements.id, adId), eq(adPlacements.businessId, user.linkedBusinessId))
      );
      if (!ad) return res.status(404).json({ message: "Ad not found" });
      const existing = ad.targetZipCodes || [];
      const merged = [...new Set([...existing, ...zipCodes])];
      const [updated] = await pgDb.update(adPlacements)
        .set({ targetZipCodes: merged })
        .where(eq(adPlacements.id, adId))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error("Error adding zip codes to ad:", err);
      res.status(500).json({ message: "Failed to add zip codes" });
    }
  });

  app.post("/api/events/:id/add-zip-codes", isAuthenticated, async (req, res) => {
    try {
      const user = req.user as any;
      const eventId = parseInt(req.params.id);
      const { zipCodes } = req.body;
      if (!Array.isArray(zipCodes) || zipCodes.length === 0) {
        return res.status(400).json({ message: "At least one zip code is required" });
      }
      const [event] = await pgDb.select().from(events).where(eq(events.id, eventId));
      if (!event) return res.status(404).json({ message: "Event not found" });
      const [dbUser] = await pgDb.select().from(users).where(eq(users.id, user.id)).limit(1);
      const isAdmin = dbUser?.accountType === "admin";
      if (!isAdmin && (!event.businessId || event.businessId !== user.linkedBusinessId)) {
        return res.status(403).json({ message: "Not authorized" });
      }
      const existing = event.targetZipCodes || [];
      const merged = [...new Set([...existing, ...zipCodes])];
      const [updated] = await pgDb.update(events)
        .set({ targetZipCodes: merged })
        .where(eq(events.id, eventId))
        .returning();
      res.json(updated);
    } catch (err) {
      console.error("Error adding zip codes to event:", err);
      res.status(500).json({ message: "Failed to add zip codes" });
    }
  });

  app.get("/api/events/my-events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user?.linkedBusinessId) {
        return res.json([]);
      }
      const myEvents = await pgDb.select().from(events)
        .where(eq(events.businessId, user.linkedBusinessId))
        .orderBy(desc(events.createdAt));
      res.json(myEvents);
    } catch (err) {
      console.error("Error fetching my events:", err);
      res.status(500).json({ message: "Failed to fetch your events" });
    }
  });

  app.patch("/api/events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const eventId = parseInt(req.params.id);
      const [event] = await pgDb.select().from(events).where(eq(events.id, eventId));
      if (!event) return res.status(404).json({ message: "Event not found" });

      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user?.linkedBusinessId || user.linkedBusinessId !== event.businessId) {
        return res.status(403).json({ message: "You can only edit your own events" });
      }

      if (event.status === "denied") {
        return res.status(400).json({ message: "Cannot edit a denied event" });
      }

      const allowedFields = ["title", "description", "location", "imageUrl", "flyerUrl", "promoVideoUrl"];
      const updates: Record<string, any> = {};
      for (const field of allowedFields) {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      }

      if (Object.keys(updates).length === 0) {
        return res.status(400).json({ message: "No valid fields to update" });
      }

      if (event.status === "approved") {
        updates.status = "pending";
        updates.adminNote = null;
      }

      const [updated] = await pgDb.update(events).set(updates).where(eq(events.id, eventId)).returning();
      res.json(updated);
    } catch (err) {
      console.error("Error updating event:", err);
      res.status(500).json({ message: "Failed to update event" });
    }
  });

  app.delete("/api/events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const eventId = parseInt(req.params.id);
      const [event] = await pgDb.select().from(events).where(eq(events.id, eventId));
      if (!event) return res.status(404).json({ message: "Event not found" });

      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user?.linkedBusinessId || user.linkedBusinessId !== event.businessId) {
        return res.status(403).json({ message: "You can only delete your own events" });
      }

      await pgDb.delete(events).where(eq(events.id, eventId));
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting event:", err);
      res.status(500).json({ message: "Failed to delete event" });
    }
  });

  // Get all events for admin moderation
  app.get("/api/admin/events", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user?.accountType !== "admin") return res.status(403).json({ message: "Admin access required" });

      const allEvents = await pgDb.select().from(events).orderBy(desc(events.createdAt));
      const eventsWithBiz = await Promise.all(
        allEvents.map(async (event) => {
          let businessName: string | null = null;
          let businessMembershipTier: string | null = null;
          if (event.businessId) {
            const [biz] = await pgDb.select({ name: businesses.name, membershipTier: businesses.membershipTier })
              .from(businesses).where(eq(businesses.id, event.businessId)).limit(1);
            if (biz) {
              businessName = biz.name;
              businessMembershipTier = biz.membershipTier;
            }
          }
          return { ...event, businessName, businessMembershipTier };
        })
      );
      res.json(eventsWithBiz);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Approve/deny an event (admin)
  app.patch("/api/admin/events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user?.accountType !== "admin") return res.status(403).json({ message: "Admin access required" });

      const eventId = Number(req.params.id);
      if (isNaN(eventId) || eventId <= 0) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      const { status, adminNote } = req.body;
      if (!["approved", "denied", "pending"].includes(status)) {
        return res.status(400).json({ message: "Status must be 'approved', 'denied', or 'pending'" });
      }
      const noteStr = typeof adminNote === "string" ? adminNote.slice(0, 1000) : null;

      const [updated] = await pgDb.update(events)
        .set({ status, adminNote: noteStr })
        .where(eq(events.id, eventId))
        .returning();

      if (!updated) return res.status(404).json({ message: "Event not found" });
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Delete an event (admin)
  app.delete("/api/admin/events/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user?.accountType !== "admin") return res.status(403).json({ message: "Admin access required" });

      const eventId = Number(req.params.id);
      if (isNaN(eventId) || eventId <= 0) {
        return res.status(400).json({ message: "Invalid event ID" });
      }
      const [deleted] = await pgDb.delete(events).where(eq(events.id, eventId)).returning();
      if (!deleted) return res.status(404).json({ message: "Event not found" });
      res.json({ message: "Event deleted" });
    } catch (err: any) {
      res.status(500).json({ message: err.message });
    }
  });

  // Get all ad requests (admin)
  app.get("/api/admin/ads", isAuthenticated, async (req, res) => {
    try {
      // Check if user is admin from database
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const [dbUser] = await pgDb.select({ accountType: users.accountType })
        .from(users)
        .where(eq(users.id, userId));
      
      if (dbUser?.accountType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const allAds = await pgDb.select({
        id: adPlacements.id,
        businessId: adPlacements.businessId,
        placementType: adPlacements.placementType,
        title: adPlacements.title,
        description: adPlacements.description,
        imageUrl: adPlacements.imageUrl,
        linkUrl: adPlacements.linkUrl,
        category: adPlacements.category,
        status: adPlacements.status,
        startDate: adPlacements.startDate,
        endDate: adPlacements.endDate,
        pricePerWeek: adPlacements.pricePerWeek,
        totalPaid: adPlacements.totalPaid,
        paymentStatus: adPlacements.paymentStatus,
        paymentNotes: adPlacements.paymentNotes,
        impressions: adPlacements.impressions,
        clicks: adPlacements.clicks,
        createdAt: adPlacements.createdAt,
        businessName: businesses.name,
      }).from(adPlacements)
        .leftJoin(businesses, eq(adPlacements.businessId, businesses.id))
        .orderBy(desc(adPlacements.createdAt));

      res.json(allAds);
    } catch (err) {
      console.error("Error fetching all ads:", err);
      res.status(500).json({ message: "Failed to fetch ads" });
    }
  });

  // Update ad status (admin)
  app.patch("/api/admin/ads/:id", isAuthenticated, async (req, res) => {
    try {
      // Check if user is admin from database
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const [dbUser] = await pgDb.select({ accountType: users.accountType })
        .from(users)
        .where(eq(users.id, userId));
      
      if (dbUser?.accountType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }

      const id = parseInt(req.params.id as string);
      const { status, paymentStatus, paymentNotes, totalPaid, startDate, endDate } = req.body;

      const updateData: any = { updatedAt: new Date() };
      if (status) updateData.status = status;
      if (paymentStatus) updateData.paymentStatus = paymentStatus;
      if (paymentNotes !== undefined) updateData.paymentNotes = paymentNotes;
      if (totalPaid !== undefined) updateData.totalPaid = totalPaid;
      if (startDate) updateData.startDate = new Date(startDate);
      if (endDate) updateData.endDate = new Date(endDate);

      const [updated] = await pgDb.update(adPlacements)
        .set(updateData)
        .where(eq(adPlacements.id, id))
        .returning();

      res.json(updated);
    } catch (err) {
      console.error("Error updating ad:", err);
      res.status(500).json({ message: "Failed to update ad" });
    }
  });

  // Category suggestion requests
  app.post("/api/category-requests", async (req, res) => {
    try {
      const parsed = insertCategoryRequestSchema.parse(req.body);
      const [request] = await pgDb.insert(categoryRequests).values(parsed).returning();
      res.json(request);
    } catch (error: any) {
      res.status(400).json({ message: error.message || "Invalid request" });
    }
  });

  // ============ PROMO CODE ROUTES ============

  app.get("/api/promo-codes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await pgDb.select().from(users).where(eq(users.id, req.user?.id)).limit(1);
      if (user[0]?.accountType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const codes = await pgDb.select().from(promoCodes).orderBy(desc(promoCodes.createdAt));
      res.json(codes);
    } catch (err) {
      console.error("Error fetching promo codes:", err);
      res.status(500).json({ message: "Failed to fetch promo codes" });
    }
  });

  app.post("/api/promo-codes", isAuthenticated, async (req: any, res) => {
    try {
      const user = await pgDb.select().from(users).where(eq(users.id, req.user?.id)).limit(1);
      if (user[0]?.accountType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { code, description, discountType, discountValue, applicableTiers, maxUses, startsAt, expiresAt, durationDays } = req.body;
      if (!code || (discountType !== "gold_trial" && !discountValue)) {
        return res.status(400).json({ message: "Code and discount value are required" });
      }
      if (discountType === "percentage" && (discountValue < 1 || discountValue > 100)) {
        return res.status(400).json({ message: "Percentage discount must be between 1 and 100" });
      }
      if (discountType === "gold_trial" && durationDays !== undefined && durationDays !== null) {
        const d = Number(durationDays);
        if (!Number.isFinite(d) || d < 1 || d > 365) {
          return res.status(400).json({ message: "Gold trial duration must be between 1 and 365 days" });
        }
      }
      const existing = await pgDb.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.code, code.toUpperCase())).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ message: "A promo code with this code already exists" });
      }
      const [newCode] = await pgDb.insert(promoCodes).values({
        code: code.toUpperCase(),
        description,
        discountType: discountType || "percentage",
        discountValue: discountValue || 0,
        applicableTiers: applicableTiers || [],
        maxUses: maxUses ?? 1,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        durationDays: durationDays || null,
      }).returning();
      res.status(201).json(newCode);
    } catch (err) {
      console.error("Error creating promo code:", err);
      res.status(500).json({ message: "Failed to create promo code" });
    }
  });

  app.patch("/api/promo-codes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await pgDb.select().from(users).where(eq(users.id, req.user?.id)).limit(1);
      if (user[0]?.accountType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const id = parseInt(req.params.id);
      const { isActive, description, maxUses, expiresAt, discountType, discountValue, applicableTiers, startsAt } = req.body;
      const updateData: any = {};
      if (isActive !== undefined) updateData.isActive = isActive;
      if (description !== undefined) updateData.description = description;
      if (maxUses !== undefined) updateData.maxUses = maxUses;
      if (expiresAt !== undefined) updateData.expiresAt = expiresAt ? new Date(expiresAt) : null;
      if (startsAt !== undefined) updateData.startsAt = startsAt ? new Date(startsAt) : null;
      if (discountType !== undefined) updateData.discountType = discountType;
      if (discountValue !== undefined) updateData.discountValue = discountValue;
      if (applicableTiers !== undefined) updateData.applicableTiers = applicableTiers;
      const [updated] = await pgDb.update(promoCodes).set(updateData).where(eq(promoCodes.id, id)).returning();
      res.json(updated);
    } catch (err) {
      console.error("Error updating promo code:", err);
      res.status(500).json({ message: "Failed to update promo code" });
    }
  });

  app.delete("/api/promo-codes/:id", isAuthenticated, async (req: any, res) => {
    try {
      const user = await pgDb.select().from(users).where(eq(users.id, req.user?.id)).limit(1);
      if (user[0]?.accountType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const id = parseInt(req.params.id);
      await pgDb.delete(promoCodeUsages).where(eq(promoCodeUsages.promoCodeId, id));
      await pgDb.delete(promoCodes).where(eq(promoCodes.id, id));
      res.json({ message: "Promo code deleted" });
    } catch (err) {
      console.error("Error deleting promo code:", err);
      res.status(500).json({ message: "Failed to delete promo code" });
    }
  });

  app.post("/api/promo-codes/validate", async (req, res) => {
    try {
      const { code, tier, businessId } = req.body;
      if (!code) {
        return res.status(400).json({ valid: false, message: "Promo code is required" });
      }

      let promo: any;
      try {
        const results = await pgDb.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase().trim())).limit(1);
        promo = results[0];
      } catch (dbErr) {
        console.error("Error querying promo_codes table:", dbErr);
        return res.status(500).json({ valid: false, message: "Unable to validate promo code at this time. Please try again." });
      }

      if (!promo) {
        return res.status(404).json({ valid: false, message: "Invalid promo code. Please check the code and try again." });
      }
      if (!promo.isActive) {
        return res.status(400).json({ valid: false, message: "This promo code is no longer active" });
      }
      if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return res.status(400).json({ valid: false, message: "This promo code has expired" });
      }
      if (promo.startsAt && new Date(promo.startsAt) > new Date()) {
        return res.status(400).json({ valid: false, message: "This promo code is not yet active" });
      }
      if (promo.maxUses && (promo.currentUses || 0) >= promo.maxUses) {
        return res.status(400).json({ valid: false, message: "This promo code has reached its usage limit" });
      }
      if (promo.discountType !== "gold_trial" && tier && promo.applicableTiers && promo.applicableTiers.length > 0) {
        if (!promo.applicableTiers.includes(tier)) {
          return res.status(400).json({ valid: false, message: `This promo code is not applicable to the ${tier} tier` });
        }
      }
      if (businessId) {
        try {
          const existingUsage = await pgDb.select({ id: promoCodeUsages.id }).from(promoCodeUsages)
            .where(and(eq(promoCodeUsages.promoCodeId, promo.id), eq(promoCodeUsages.businessId, businessId))).limit(1);
          if (existingUsage.length > 0) {
            return res.status(400).json({ valid: false, message: "This promo code has already been used by your business" });
          }
        } catch (usageErr) {
          console.error("Error checking promo code usage:", usageErr);
        }
      }
      res.json({
        valid: true,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        description: promo.description,
        expiresAt: promo.expiresAt ? promo.expiresAt.toISOString() : null,
        applicableTiers: promo.applicableTiers || [],
        durationDays: promo.durationDays || null,
      });
    } catch (err) {
      console.error("Error validating promo code:", err);
      res.status(500).json({ valid: false, message: "Unable to validate promo code. Please try again later." });
    }
  });

  app.post("/api/promo-codes/redeem", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const { code } = req.body;
      if (!code) return res.status(400).json({ message: "Promo code is required" });

      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length || !user[0].linkedBusinessId) {
        return res.status(400).json({ message: "You need a business listing to redeem a promo code" });
      }

      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, user[0].linkedBusinessId)).limit(1);
      if (!biz) return res.status(404).json({ message: "Business not found" });

      const [promo] = await pgDb.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase().trim())).limit(1);
      if (!promo) return res.status(404).json({ message: "Invalid promo code" });
      if (!promo.isActive) return res.status(400).json({ message: "This promo code is no longer active" });
      if (promo.expiresAt && new Date(promo.expiresAt) < new Date()) {
        return res.status(400).json({ message: "This promo code has expired" });
      }
      if (promo.startsAt && new Date(promo.startsAt) > new Date()) {
        return res.status(400).json({ message: "This promo code is not yet active" });
      }
      if (promo.maxUses && (promo.currentUses || 0) >= promo.maxUses) {
        return res.status(400).json({ message: "This promo code has reached its usage limit" });
      }

      const existingUsage = await pgDb.select({ id: promoCodeUsages.id }).from(promoCodeUsages)
        .where(and(eq(promoCodeUsages.promoCodeId, promo.id), eq(promoCodeUsages.businessId, biz.id))).limit(1);
      if (existingUsage.length > 0) {
        return res.status(400).json({ message: "This promo code has already been used by your business" });
      }

      if (promo.discountType === "gold_trial") {
        const durationDays = promo.durationDays || 30;
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + durationDays);

        if (biz.membershipTier === "premium" && !biz.originalMembershipTier) {
          return res.status(400).json({ message: "You already have Gold membership" });
        }

        const originalTier = biz.originalMembershipTier || biz.membershipTier || "none";

        await pgDb.update(businesses).set({
          membershipTier: "premium",
          originalMembershipTier: originalTier,
          goldTrialEndDate: trialEnd,
        }).where(eq(businesses.id, biz.id));

        await pgDb.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1` }).where(eq(promoCodes.id, promo.id));
        await pgDb.insert(promoCodeUsages).values({
          promoCodeId: promo.id,
          businessId: biz.id,
        });

        const tierMap: Record<string, string> = { basic: "Bronze", standard: "Silver", premium: "Gold", none: "None" };
        console.log(`Gold trial promo redeemed: business ${biz.id} (${biz.name}) upgraded to Gold for ${durationDays} days, reverts to ${tierMap[originalTier] || originalTier}`);

        return res.json({
          success: true,
          message: `Gold access activated for ${durationDays} days!`,
          goldTrialEndDate: trialEnd.toISOString(),
          durationDays,
          originalTier,
        });
      }

      if (promo.discountType === "percentage" || promo.discountType === "fixed_amount") {
        if (!biz.stripeSubscriptionId) {
          return res.status(400).json({ message: "You need an active subscription to apply this discount. Please subscribe on the membership page first." });
        }

        try {
          const stripe = new (await import("stripe")).default(process.env.Stripeintegration || "");

          const isFullDiscount = promo.discountType === "percentage" && (promo.discountValue || 0) >= 100;
          const freeDays = promo.durationDays && promo.durationDays > 0 ? promo.durationDays : null;

          if (isFullDiscount && freeDays) {
            const sub = await stripe.subscriptions.retrieve(biz.stripeSubscriptionId);
            const nowSec = Math.floor(Date.now() / 1000);
            const baseSec = (sub.trial_end && sub.trial_end > nowSec) ? sub.trial_end : nowSec;
            const newTrialEnd = baseSec + freeDays * 86400;

            await stripe.subscriptions.update(biz.stripeSubscriptionId, {
              trial_end: newTrialEnd,
              proration_behavior: "none",
            });

            await pgDb.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1` }).where(eq(promoCodes.id, promo.id));
            await pgDb.insert(promoCodeUsages).values({ promoCodeId: promo.id, businessId: biz.id });

            console.log(`Promo redeemed: business ${biz.id} (${biz.name}) free trial extended by ${freeDays} days, new trial_end=${new Date(newTrialEnd * 1000).toISOString()}`);

            return res.json({
              success: true,
              message: `Free access activated for ${freeDays} more days!`,
              freeDays,
              trialEnd: new Date(newTrialEnd * 1000).toISOString(),
            });
          }

          let coupon;
          if (promo.discountType === "percentage") {
            coupon = await stripe.coupons.create({
              percent_off: promo.discountValue || 0,
              duration: "once",
              name: `Promo: ${promo.code}`,
            });
          } else {
            coupon = await stripe.coupons.create({
              amount_off: Math.round((promo.discountValue || 0) * 100),
              currency: "usd",
              duration: "once",
              name: `Promo: ${promo.code}`,
            });
          }

          await stripe.subscriptions.update(biz.stripeSubscriptionId, {
            coupon: coupon.id,
          });

          await pgDb.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1` }).where(eq(promoCodes.id, promo.id));
          await pgDb.insert(promoCodeUsages).values({
            promoCodeId: promo.id,
            businessId: biz.id,
          });

          const discountLabel = promo.discountType === "percentage"
            ? `${promo.discountValue}% off`
            : `$${promo.discountValue} off`;

          console.log(`Promo code redeemed: business ${biz.id} (${biz.name}) applied ${discountLabel} to subscription`);

          return res.json({
            success: true,
            message: `Discount applied! ${discountLabel} your next billing cycle.`,
            discountType: promo.discountType,
            discountValue: promo.discountValue,
          });
        } catch (stripeErr: any) {
          console.error("Error applying promo to Stripe subscription:", stripeErr);
          return res.status(500).json({ message: "Could not apply discount to your subscription. Please try again or contact support." });
        }
      }

      return res.status(400).json({ message: "This promo code type is not supported" });
    } catch (err) {
      console.error("Error redeeming promo code:", err);
      res.status(500).json({ message: "Failed to redeem promo code" });
    }
  });

  app.get("/api/user/gold-trial-status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length || !user[0].linkedBusinessId) {
        return res.json({ active: false });
      }
      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, user[0].linkedBusinessId)).limit(1);
      if (!biz || !biz.goldTrialEndDate || !biz.originalMembershipTier) {
        return res.json({ active: false });
      }

      const now = new Date();
      const endDate = new Date(biz.goldTrialEndDate);
      const daysLeft = Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));

      if (daysLeft <= 0) {
        return res.json({ active: false, expired: true });
      }

      const tierMap: Record<string, string> = { basic: "Bronze", standard: "Silver", premium: "Gold", none: "None" };
      res.json({
        active: true,
        daysLeft,
        endDate: endDate.toISOString(),
        revertTier: biz.originalMembershipTier,
        revertTierLabel: tierMap[biz.originalMembershipTier] || biz.originalMembershipTier,
      });
    } catch (err) {
      console.error("Error checking gold trial status:", err);
      res.json({ active: false });
    }
  });

  app.get("/api/user/comp-expiration", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!user.length || !user[0].linkedBusinessId) {
        return res.json({ active: false });
      }
      const [biz] = await pgDb
        .select({
          isCompedMembership: businesses.isCompedMembership,
          compedMembershipExpiresAt: businesses.compedMembershipExpiresAt,
        })
        .from(businesses)
        .where(eq(businesses.id, user[0].linkedBusinessId))
        .limit(1);

      if (!biz || !biz.isCompedMembership || !biz.compedMembershipExpiresAt) {
        return res.json({ active: false });
      }

      const now = new Date();
      const endDate = new Date(biz.compedMembershipExpiresAt);
      const msLeft = endDate.getTime() - now.getTime();

      if (msLeft <= 0) {
        return res.json({ active: false });
      }

      const daysLeft = Math.ceil(msLeft / (1000 * 60 * 60 * 24));

      if (daysLeft > 14) {
        return res.json({ active: false });
      }

      res.json({
        active: true,
        daysLeft,
        endDate: endDate.toISOString(),
      });
    } catch (err) {
      console.error("Error checking comp membership expiration:", err);
      res.json({ active: false });
    }
  });

  app.get("/api/membership-downgrades", isAuthenticated, async (req: any, res) => {
    try {
      const user = await pgDb.select().from(users).where(eq(users.id, req.user?.id)).limit(1);
      if (user[0]?.accountType !== "admin") {
        return res.status(403).json({ message: "Admin access required" });
      }
      const downgrades = await pgDb.select().from(membershipDowngrades).orderBy(desc(membershipDowngrades.downgradedAt));
      res.json(downgrades);
    } catch (err) {
      console.error("Error fetching downgrades:", err);
      res.status(500).json({ message: "Failed to fetch downgrades" });
    }
  });

  app.get("/api/my-business/win-back", isAuthenticated, async (req: any, res) => {
    try {
      const linkedBusinessId = req.user?.linkedBusinessId;
      if (!linkedBusinessId) return res.json({ eligible: false });
      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, linkedBusinessId)).limit(1);
      if (!biz) return res.json({ eligible: false });
      const now = new Date();
      const [downgrade] = await pgDb.select().from(membershipDowngrades)
        .where(and(
          eq(membershipDowngrades.businessId, biz.id),
          lte(membershipDowngrades.winBackEligibleAt, now)
        ))
        .orderBy(desc(membershipDowngrades.downgradedAt))
        .limit(1);
      if (downgrade) {
        res.json({
          eligible: true,
          previousTier: downgrade.previousTier,
          downgradedAt: downgrade.downgradedAt,
          winBackEligibleAt: downgrade.winBackEligibleAt,
        });
      } else {
        res.json({ eligible: false });
      }
    } catch (err) {
      console.error("Error checking win-back eligibility:", err);
      res.status(500).json({ message: "Failed to check eligibility" });
    }
  });

  // ============ ADMIN DASHBOARD ROUTES ============

  app.get("/api/admin/users/:userId/details", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const targetId = req.params.userId;
      const [user] = await pgDb.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        profileImageUrl: users.profileImageUrl,
        accountType: users.accountType,
        isValidated: users.isValidated,
        linkedBusinessId: users.linkedBusinessId,
        googleId: users.googleId,
        loyaltyTier: users.loyaltyTier,
        loyaltyPoints: users.loyaltyPoints,
        customerRating: users.customerRating,
        projectsCompleted: users.projectsCompleted,
        totalSpent: users.totalSpent,
        engagementBadge: users.engagementBadge,
        postCount: users.postCount,
        commentCount: users.commentCount,
        likesReceived: users.likesReceived,
        memberSince: users.memberSince,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
      }).from(users).where(eq(users.id, targetId));

      if (!user) return res.status(404).json({ message: "User not found" });

      let linkedBusiness = null;
      if (user.linkedBusinessId) {
        const [biz] = await pgDb.select({
          id: businesses.id,
          name: businesses.name,
          membershipTier: businesses.membershipTier,
          verified: businesses.verified,
          category: businesses.category,
        }).from(businesses).where(eq(businesses.id, user.linkedBusinessId));
        linkedBusiness = biz || null;
      }

      res.json({ user, linkedBusiness });
    } catch (err) {
      console.error("Admin get user details error:", err);
      res.status(500).json({ message: "Failed to get user details" });
    }
  });

  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const search = (req.query.search || "").toString().trim();
      const parsed = parseInt(req.query.page || "1");
      const page = isNaN(parsed) ? 1 : Math.max(1, parsed);
      const limit = 25;
      const offset = (page - 1) * limit;

      let query = pgDb.select({
        id: users.id,
        email: users.email,
        firstName: users.firstName,
        lastName: users.lastName,
        accountType: users.accountType,
        isValidated: users.isValidated,
        linkedBusinessId: users.linkedBusinessId,
        googleId: users.googleId,
        createdAt: users.createdAt,
      }).from(users);

      if (search) {
        query = query.where(
          or(
            ilike(users.email, `%${search}%`),
            ilike(users.firstName, `%${search}%`),
            ilike(users.lastName, `%${search}%`)
          )
        ) as any;
      }

      const allUsers = await (query as any).orderBy(desc(users.createdAt)).limit(limit).offset(offset);
      const [{ count: totalCount }] = search
        ? await pgDb.select({ count: sql<number>`count(*)::int` }).from(users).where(
            or(ilike(users.email, `%${search}%`), ilike(users.firstName, `%${search}%`), ilike(users.lastName, `%${search}%`))
          )
        : await pgDb.select({ count: sql<number>`count(*)::int` }).from(users);

      res.json({ users: allUsers, total: totalCount, page, pages: Math.ceil(totalCount / limit) });
    } catch (err) {
      console.error("Admin list users error:", err);
      res.status(500).json({ message: "Failed to list users" });
    }
  });

  app.delete("/api/admin/users/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const targetId = req.params.userId;
      if (targetId === adminId) return res.status(400).json({ message: "Cannot delete your own account" });

      const [target] = await pgDb.select({ id: users.id, email: users.email, linkedBusinessId: users.linkedBusinessId }).from(users).where(eq(users.id, targetId));
      if (!target) return res.status(404).json({ message: "User not found" });

      if (target.linkedBusinessId) {
        const [biz] = await pgDb.select({ stripeCustomerId: businesses.stripeCustomerId, stripeSubscriptionId: businesses.stripeSubscriptionId }).from(businesses).where(eq(businesses.id, target.linkedBusinessId));
        if (biz?.stripeSubscriptionId) {
          try {
            const stripe = (await import("stripe")).default;
            const stripeClient = new stripe(process.env.Stripeintegration || "");
            await stripeClient.subscriptions.cancel(biz.stripeSubscriptionId);
          } catch (e: any) {
            console.log("Could not cancel subscription during delete:", e?.message);
          }
        }
      }

      await pgDb.transaction(async (tx) => {
        if (target.linkedBusinessId) {
          const bizId = target.linkedBusinessId;
          await tx.delete(businessVerificationChecks).where(eq(businessVerificationChecks.businessId, bizId));
          await tx.delete(verificationDocuments).where(eq(verificationDocuments.businessId, bizId));
          await tx.delete(reviews).where(eq(reviews.businessId, bizId));
          await tx.delete(jobListings).where(eq(jobListings.businessId, bizId));
          await tx.delete(adPlacements).where(eq(adPlacements.businessId, bizId));
          await tx.delete(promoCodeUsages).where(eq(promoCodeUsages.businessId, bizId));
          await tx.delete(membershipDowngrades).where(eq(membershipDowngrades.businessId, bizId));
          await tx.delete(businessAnalytics).where(eq(businessAnalytics.businessId, bizId));
          await tx.delete(events).where(eq(events.businessId, bizId));

          const bizQuotes = await tx.select({ id: quotes.id }).from(quotes).where(eq(quotes.businessId, bizId));
          for (const q of bizQuotes) {
            await tx.delete(quoteMessages).where(eq(quoteMessages.quoteId, q.id));
          }
          await tx.delete(quotes).where(eq(quotes.businessId, bizId));
          await tx.delete(quotePriorityAssignments).where(eq(quotePriorityAssignments.businessId, bizId));

          await tx.delete(businesses).where(eq(businesses.id, bizId));
        }

        await tx.delete(quoteMessages).where(eq(quoteMessages.senderId, targetId));

        const userQuotes = await tx.select({ id: quotes.id }).from(quotes).where(eq(quotes.userId, targetId));
        for (const q of userQuotes) {
          await tx.delete(quoteMessages).where(eq(quoteMessages.quoteId, q.id));
        }
        await tx.delete(quotes).where(eq(quotes.userId, targetId));

        const userQuoteRequests = await tx.select({ id: quoteRequests.id }).from(quoteRequests).where(eq(quoteRequests.userId, targetId));
        for (const qr of userQuoteRequests) {
          const reqQuotes = await tx.select({ id: quotes.id }).from(quotes).where(eq(quotes.requestId, qr.id));
          for (const q of reqQuotes) {
            await tx.delete(quoteMessages).where(eq(quoteMessages.quoteId, q.id));
          }
          await tx.delete(quotes).where(eq(quotes.requestId, qr.id));
          await tx.delete(quotePriorityAssignments).where(eq(quotePriorityAssignments.requestId, qr.id));
        }
        await tx.delete(quoteRequests).where(eq(quoteRequests.userId, targetId));

        await tx.delete(reviews).where(eq(reviews.userId, targetId));

        const userPosts = await tx.select({ id: postsTable.id }).from(postsTable).where(eq(postsTable.authorId, targetId));
        for (const p of userPosts) {
          await tx.delete(commentsTable).where(eq(commentsTable.postId, p.id));
        }
        await tx.delete(commentsTable).where(eq(commentsTable.authorId, targetId));
        await tx.delete(postsTable).where(eq(postsTable.authorId, targetId));

        await tx.delete(adminSubmissions).where(eq(adminSubmissions.userId, targetId));
        await tx.delete(receipts).where(eq(receipts.userId, targetId));
        await tx.delete(users).where(eq(users.id, targetId));
      });

      res.json({ message: `User ${target.email} and associated business deleted successfully` });
    } catch (err) {
      console.error("Admin delete user error:", err);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  app.delete("/api/admin/businesses/:businessId", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const bizId = parseInt(req.params.businessId);
      if (!bizId) return res.status(400).json({ message: "Invalid business ID" });

      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, bizId));
      if (!biz) return res.status(404).json({ message: "Business not found" });

      if (biz.stripeSubscriptionId) {
        try {
          const stripe = (await import("stripe")).default;
          const stripeClient = new stripe(process.env.Stripeintegration || "");
          await stripeClient.subscriptions.cancel(biz.stripeSubscriptionId);
        } catch (e: any) {
          console.log("Could not cancel subscription during business delete:", e?.message);
        }
      }

      await pgDb.transaction(async (tx) => {
        await tx.delete(businessVerificationChecks).where(eq(businessVerificationChecks.businessId, bizId));
        await tx.delete(verificationDocuments).where(eq(verificationDocuments.businessId, bizId));
        await tx.delete(reviews).where(eq(reviews.businessId, bizId));
        await tx.delete(jobListings).where(eq(jobListings.businessId, bizId));
        await tx.delete(adPlacements).where(eq(adPlacements.businessId, bizId));
        await tx.delete(promoCodeUsages).where(eq(promoCodeUsages.businessId, bizId));
        await tx.delete(membershipDowngrades).where(eq(membershipDowngrades.businessId, bizId));
        await tx.delete(businessAnalytics).where(eq(businessAnalytics.businessId, bizId));
        await tx.delete(events).where(eq(events.businessId, bizId));

        const bizQuotes = await tx.select({ id: quotes.id }).from(quotes).where(eq(quotes.businessId, bizId));
        for (const q of bizQuotes) {
          await tx.delete(quoteMessages).where(eq(quoteMessages.quoteId, q.id));
        }
        await tx.delete(quotes).where(eq(quotes.businessId, bizId));
        await tx.delete(quotePriorityAssignments).where(eq(quotePriorityAssignments.businessId, bizId));

        await tx.update(users).set({ linkedBusinessId: null }).where(eq(users.linkedBusinessId, bizId));
        await tx.delete(businesses).where(eq(businesses.id, bizId));
      });

      res.json({ message: `Business "${biz.name}" deleted successfully` });
    } catch (err) {
      console.error("Admin delete business error:", err);
      res.status(500).json({ message: "Failed to delete business" });
    }
  });

  app.post("/api/admin/users/:userId/reset-password", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const targetId = req.params.userId;
      const { newPassword } = req.body;
      if (!newPassword || newPassword.length < 6) return res.status(400).json({ message: "Password must be at least 6 characters" });

      const [target] = await pgDb.select({ id: users.id }).from(users).where(eq(users.id, targetId));
      if (!target) return res.status(404).json({ message: "User not found" });

      const bcrypt = await import("bcrypt");
      const hash = await bcrypt.hash(newPassword, 12);
      await pgDb.update(users).set({ passwordHash: hash, googleId: null }).where(eq(users.id, targetId));
      res.json({ message: "Password reset successfully" });
    } catch (err) {
      console.error("Admin reset password error:", err);
      res.status(500).json({ message: "Failed to reset password" });
    }
  });

  app.patch("/api/admin/users/:userId", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const targetId = req.params.userId;
      const [target] = await pgDb.select({ id: users.id, email: users.email, accountType: users.accountType, isAdmin: users.isAdmin }).from(users).where(eq(users.id, targetId));
      if (!target) return res.status(404).json({ message: "User not found" });

      // Prevent admins from editing OTHER admin accounts (self-edit allowed for name/email).
      const targetIsAdmin = target.accountType === "admin" || target.isAdmin === true;
      if (targetIsAdmin && targetId !== adminId) {
        return res.status(403).json({ message: "Cannot edit another admin account from this screen" });
      }

      const { isValidated, accountType, firstName, lastName, email } = req.body;
      const updates: any = {};
      if (typeof isValidated === "boolean") updates.isValidated = isValidated;
      if (accountType && accountType !== "admin") updates.accountType = accountType;
      if (typeof firstName === "string") updates.firstName = firstName.trim() || null;
      if (typeof lastName === "string") updates.lastName = lastName.trim() || null;
      if (typeof email === "string") {
        const newEmail = email.trim().toLowerCase();
        if (newEmail && newEmail !== (target.email || "").toLowerCase()) {
          // Basic email shape check
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
            return res.status(400).json({ message: "Invalid email format" });
          }
          // Uniqueness check
          const [existing] = await pgDb.select({ id: users.id }).from(users).where(eq(users.email, newEmail));
          if (existing && existing.id !== targetId) {
            return res.status(409).json({ message: "Another account already uses that email" });
          }
          updates.email = newEmail;
        }
      }

      if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No updates provided" });

      await pgDb.update(users).set(updates).where(eq(users.id, targetId));
      res.json({ message: "User updated successfully" });
    } catch (err) {
      console.error("Admin update user error:", err);
      res.status(500).json({ message: "Failed to update user" });
    }
  });

  // Admin "sign in as" — start impersonating a non-admin user. The original
  // admin id is stashed on the session so /stop-impersonating can restore it.
  app.post("/api/admin/impersonate/:userId", isAuthenticated, async (req: any, res, next) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const targetId = req.params.userId;
      if (targetId === adminId) {
        return res.status(400).json({ message: "Cannot impersonate yourself" });
      }

      const [target] = await pgDb.select().from(users).where(eq(users.id, targetId));
      if (!target) return res.status(404).json({ message: "User not found" });
      if (target.accountType === "admin" || target.isAdmin === true) {
        return res.status(403).json({ message: "Cannot impersonate another admin" });
      }

      // Preserve the original admin across nested impersonations.
      const originalAdminId = (req.session as any).impersonatorId || adminId;

      req.login(target, (err: any) => {
        if (err) return next(err);
        (req.session as any).impersonatorId = originalAdminId;
        const { passwordHash: _ph, ...safe } = target as any;
        res.json({ ...safe, impersonatedBy: originalAdminId });
      });
    } catch (err) {
      console.error("[admin] impersonate error:", err);
      res.status(500).json({ message: "Impersonation failed" });
    }
  });

  app.post("/api/admin/stop-impersonating", isAuthenticated, async (req: any, res, next) => {
    try {
      const originalAdminId = (req.session as any).impersonatorId;
      if (!originalAdminId) return res.status(400).json({ message: "Not impersonating" });

      const [admin] = await pgDb.select().from(users).where(eq(users.id, originalAdminId));
      if (!admin) {
        delete (req.session as any).impersonatorId;
        return res.status(404).json({ message: "Original admin user not found" });
      }

      req.login(admin, (err: any) => {
        if (err) return next(err);
        delete (req.session as any).impersonatorId;
        const { passwordHash: _ph, ...safe } = admin as any;
        res.json(safe);
      });
    } catch (err) {
      console.error("[admin] stop-impersonate error:", err);
      res.status(500).json({ message: "Failed to stop impersonating" });
    }
  });

  app.get("/api/admin/businesses", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const search = (req.query.search || "").toString().trim();
      const parsed = parseInt(req.query.page || "1");
      const page = isNaN(parsed) ? 1 : Math.max(1, parsed);
      const limit = 25;
      const offset = (page - 1) * limit;

      let allBiz: any[] = [];
      let totalCount = 0;

      try {
        let query = pgDb.select({
          id: businesses.id,
          name: businesses.name,
          email: businesses.email,
          phone: businesses.phone,
          zipCode: businesses.zipCode,
          membershipTier: businesses.membershipTier,
          membershipStartDate: businesses.membershipStartDate,
          membershipEndDate: businesses.membershipEndDate,
          originalMembershipTier: businesses.originalMembershipTier,
          goldTrialEndDate: businesses.goldTrialEndDate,
          verified: businesses.verified,
          acceptsQuotes: businesses.acceptsQuotes,
          isCompedMembership: businesses.isCompedMembership,
          compedMembershipExpiresAt: businesses.compedMembershipExpiresAt,
          compedMembershipNote: businesses.compedMembershipNote,
          createdAt: businesses.createdAt,
        }).from(businesses);

        if (search) {
          query = query.where(
            or(
              ilike(businesses.name, `%${search}%`),
              ilike(businesses.email, `%${search}%`),
              ilike(businesses.phone, `%${search}%`)
            )
          ) as any;
        }

        allBiz = await (query as any).orderBy(desc(businesses.createdAt)).limit(limit).offset(offset);
      } catch (colErr) {
        console.error("Admin businesses select error (retrying with basic columns):", colErr);
        let fallback = pgDb.select({
          id: businesses.id,
          name: businesses.name,
          zipCode: businesses.zipCode,
          membershipTier: businesses.membershipTier,
          verified: businesses.verified,
          createdAt: businesses.createdAt,
        }).from(businesses);
        if (search) {
          fallback = fallback.where(ilike(businesses.name, `%${search}%`)) as any;
        }
        allBiz = await (fallback as any).orderBy(desc(businesses.createdAt)).limit(limit).offset(offset);
      }

      try {
        const [countResult] = search
          ? await pgDb.select({ count: sql<number>`count(*)::int` }).from(businesses).where(ilike(businesses.name, `%${search}%`))
          : await pgDb.select({ count: sql<number>`count(*)::int` }).from(businesses);
        totalCount = countResult?.count ?? 0;
      } catch {
        totalCount = allBiz.length;
      }

      res.json({ businesses: allBiz, total: totalCount, page, pages: Math.ceil(totalCount / limit) });
    } catch (err) {
      console.error("Admin list businesses error:", err);
      res.status(500).json({ message: "Failed to list businesses" });
    }
  });

  // Return ALL editable business fields for the admin Edit dialog.
  app.get("/api/admin/businesses/:id/full", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const bizId = parseInt(req.params.id);
      if (isNaN(bizId)) return res.status(400).json({ message: "Invalid business ID" });

      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, bizId));
      if (!biz) return res.status(404).json({ message: "Business not found" });
      res.json(biz);
    } catch (err) {
      console.error("Admin get business full error:", err);
      res.status(500).json({ message: "Failed to load business" });
    }
  });

  app.patch("/api/admin/businesses/:id", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const bizId = parseInt(req.params.id);
      if (isNaN(bizId)) return res.status(400).json({ message: "Invalid business ID" });

      const [target] = await pgDb.select({ id: businesses.id }).from(businesses).where(eq(businesses.id, bizId));
      if (!target) return res.status(404).json({ message: "Business not found" });

      // Whitelist of fields admins may edit on a business (excludes Stripe IDs, dates, etc.)
      // NOTE: `membershipTier` is intentionally NOT in this list. Tier
      // changes are routed through the Stripe billing flow or the admin
      // comp-membership endpoint (`/api/admin/businesses/:id/comp`) so a
      // routine profile-edit save can never accidentally promote/demote
      // a business's paid plan.
      const STRING_FIELDS = [
        "name", "description", "address", "city", "state", "zipCode", "category",
        "imageUrl", "logoUrl", "promoVideoUrl", "websiteUrl", "phone", "email",
        "ownerName", "businessHours", "socialMediaUrls", "searchKeywords",
        "localOperationDescription", "establishedZipCode",
        "silverPerk", "goldPerk", "platinumPerk", "ambassadorPerk",
      ] as const;
      // These columns are NOT NULL in the schema — reject empty strings so the
      // owner-facing listing doesn't end up with a blank required field.
      const REQUIRED_NON_EMPTY = new Set([
        "name", "description", "address", "category", "imageUrl",
      ]);
      const BOOL_FIELDS = [
        "verified", "hasLLC", "hasInsurance", "isLicensed", "isVeteran",
        "servicesCommercial", "servicesResidential", "acceptsQuotes",
        "isLocal365Partner",
      ] as const;
      const INT_FIELDS = ["establishedYear"] as const;
      const ARRAY_FIELDS = ["additionalCategories", "galleryPhotos"] as const;

      const updates: any = {};
      for (const f of STRING_FIELDS) {
        if (req.body[f] !== undefined) {
          const v = req.body[f];
          if (v === null || v === "") {
            // Don't allow blanking out NOT NULL fields
            if (REQUIRED_NON_EMPTY.has(f)) continue;
            updates[f] = null;
          } else {
            updates[f] = String(v);
          }
        }
      }
      for (const f of BOOL_FIELDS) {
        if (typeof req.body[f] === "boolean") updates[f] = req.body[f];
      }
      for (const f of INT_FIELDS) {
        if (req.body[f] !== undefined) {
          const v = req.body[f];
          if (v === null || v === "") updates[f] = null;
          else {
            const n = parseInt(v);
            if (!isNaN(n)) updates[f] = n;
          }
        }
      }
      for (const f of ARRAY_FIELDS) {
        if (Array.isArray(req.body[f])) {
          updates[f] = req.body[f].map((x: any) => String(x)).filter((x: string) => x.length > 0);
        }
      }

      if (Object.keys(updates).length === 0) return res.status(400).json({ message: "No updates provided" });

      await pgDb.update(businesses).set(updates).where(eq(businesses.id, bizId));
      res.json({ message: "Business updated successfully" });
    } catch (err) {
      console.error("Admin update business error:", err);
      res.status(500).json({ message: "Failed to update business" });
    }
  });

  // Admin comp-membership: grant or revoke a free Gold-equivalent flag on a
  // business. Treated as Gold by every per-feature `effectiveTier()` helper.
  // Does NOT touch `membershipTier` or any Stripe object — comping is
  // orthogonal to billing so it can never collide with a real subscription
  // or trial. Audit fields (`compedMembershipGrantedAt/By`, `compedMembershipNote`)
  // are stamped on grant and cleared on revoke.
  // Roster of every business currently flagged as comped (active or expired).
  // The admin "Comp Memberships" panel uses this for the at-a-glance view that
  // doesn't require paginating through the full business table.
  app.get("/api/admin/comp-memberships", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const rows = await pgDb
        .select({
          id: businesses.id,
          name: businesses.name,
          email: businesses.email,
          zipCode: businesses.zipCode,
          membershipTier: businesses.membershipTier,
          isCompedMembership: businesses.isCompedMembership,
          compedMembershipNote: businesses.compedMembershipNote,
          compedMembershipGrantedAt: businesses.compedMembershipGrantedAt,
          compedMembershipGrantedBy: businesses.compedMembershipGrantedBy,
          compedMembershipExpiresAt: businesses.compedMembershipExpiresAt,
          compedWelcomeEmailSentAt: businesses.compedWelcomeEmailSentAt,
        })
        .from(businesses)
        .where(eq(businesses.isCompedMembership, true))
        .orderBy(desc(businesses.compedMembershipGrantedAt));

      const now = Date.now();
      const enriched = rows.map((r) => ({
        ...r,
        compActive: !r.compedMembershipExpiresAt || new Date(r.compedMembershipExpiresAt).getTime() > now,
      }));

      res.json({
        businesses: enriched,
        welcomeResendCooldownSeconds: Math.round(COMP_RESEND_COOLDOWN_MS / 1000),
      });
    } catch (err) {
      console.error("Admin comp roster error:", err);
      res.status(500).json({ message: "Failed to load comp roster" });
    }
  });

  // Per-business audit history of every comp grant / revoke / auto-expire so
  // admins can answer "why was this comped before?" without DB access. Joins
  // `users` so the actor's email shows up instead of a bare user id.
  app.get("/api/admin/businesses/:id/comp-history", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const bizId = parseInt(req.params.id);
      if (isNaN(bizId)) return res.status(400).json({ message: "Invalid business ID" });

      const rows = await pgDb
        .select({
          id: compMembershipAudit.id,
          businessId: compMembershipAudit.businessId,
          action: compMembershipAudit.action,
          actorUserId: compMembershipAudit.actorUserId,
          actorEmail: users.email,
          note: compMembershipAudit.note,
          expiresAt: compMembershipAudit.expiresAt,
          createdAt: compMembershipAudit.createdAt,
        })
        .from(compMembershipAudit)
        .leftJoin(users, eq(users.id, compMembershipAudit.actorUserId))
        .where(eq(compMembershipAudit.businessId, bizId))
        .orderBy(desc(compMembershipAudit.createdAt));

      res.json({ history: rows });
    } catch (err) {
      console.error("Admin comp history error:", err);
      res.status(500).json({ message: "Failed to load comp history" });
    }
  });

  app.post("/api/admin/businesses/:id/comp", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const bizId = parseInt(req.params.id);
      if (isNaN(bizId)) return res.status(400).json({ message: "Invalid business ID" });

      const active = req.body?.active === true;
      const note = typeof req.body?.note === "string" ? req.body.note.slice(0, 500) : null;

      // Optional expiry (ISO string or null). Reject malformed/past dates so a
      // typo can't auto-revoke the grant the moment it's saved.
      let expiresAt: Date | null = null;
      if (active && req.body?.expiresAt) {
        const parsed = new Date(req.body.expiresAt);
        if (isNaN(parsed.getTime())) {
          return res.status(400).json({ message: "Invalid expiresAt date" });
        }
        if (parsed.getTime() <= Date.now()) {
          return res.status(400).json({ message: "Expiry must be in the future" });
        }
        expiresAt = parsed;
      }

      // Helper does the DB write + audit insert and returns the resolved
      // recipient email (or null when the business + owner have no email
      // on file). Extracted so the grant/revoke flow has direct unit-test
      // coverage independent of Express + the admin auth middleware.
      const result = await setBusinessCompMembership({ bizId, adminId, active, note, expiresAt });
      if (!result) return res.status(404).json({ message: "Business not found" });

      // Fire-and-forget so a slow/failing Resend call never blocks the
      // admin response.
      if (active) {
        notifyCompGranted({
          recipientEmail: result.recipientEmail,
          businessName: result.businessName,
          expiresAt,
          note,
        })
          .then(async (sent) => {
            if (sent) {
              await pgDb
                .update(businesses)
                .set({ compedWelcomeEmailSentAt: new Date() })
                .where(eq(businesses.id, bizId));
            }
          })
          .catch((e) => console.error("notifyCompGranted error:", e));
      } else {
        notifyCompRevoked({
          recipientEmail: result.recipientEmail,
          businessName: result.businessName,
        }).catch((e) => console.error("notifyCompRevoked error:", e));
      }

      res.json({ ok: true, isCompedMembership: active, compedMembershipExpiresAt: expiresAt });
    } catch (err) {
      console.error("Admin comp membership error:", err);
      res.status(500).json({ message: "Failed to update comp membership" });
    }
  });

  // Re-trigger the comp welcome email without revoking/re-granting. Useful
  // when the recipient says it never showed up (typo, spam folder, etc.).
  // Throttled per-business so a stuck button or curious admin can't spam
  // the recipient's inbox.
  app.post("/api/admin/businesses/:id/comp/resend-welcome", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const bizId = parseInt(req.params.id);
      if (isNaN(bizId)) return res.status(400).json({ message: "Invalid business ID" });

      const last = compResendThrottle.get(bizId);
      const now = Date.now();
      if (last && now - last < COMP_RESEND_COOLDOWN_MS) {
        const retryAfter = Math.ceil((COMP_RESEND_COOLDOWN_MS - (now - last)) / 1000);
        res.setHeader("Retry-After", String(retryAfter));
        return res.status(429).json({
          message: `Please wait ${retryAfter}s before resending again.`,
          retryAfter,
        });
      }

      const [target] = await pgDb
        .select({
          id: businesses.id,
          name: businesses.name,
          email: businesses.email,
          ownerUserId: businesses.ownerUserId,
          isCompedMembership: businesses.isCompedMembership,
          compedMembershipNote: businesses.compedMembershipNote,
          compedMembershipExpiresAt: businesses.compedMembershipExpiresAt,
        })
        .from(businesses)
        .where(eq(businesses.id, bizId));
      if (!target) return res.status(404).json({ message: "Business not found" });
      if (!target.isCompedMembership) {
        return res.status(400).json({ message: "Business is not currently comped" });
      }

      let recipientEmail: string | null = target.email ?? null;
      if (!recipientEmail && target.ownerUserId) {
        const [owner] = await pgDb
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, target.ownerUserId));
        recipientEmail = owner?.email ?? null;
      }
      if (!recipientEmail) {
        return res.status(400).json({ message: "No recipient email on file for this business" });
      }

      // Reserve the throttle slot before sending so a slow Resend call can't
      // be hammered with parallel clicks.
      compResendThrottle.set(bizId, now);

      const sent = await notifyCompGranted({
        recipientEmail,
        businessName: target.name,
        expiresAt: target.compedMembershipExpiresAt,
        note: target.compedMembershipNote,
      });

      // Stamp the last-sent time so the admin panel can show "5m ago" and
      // visually disable the resend button during the cooldown window.
      let sentAt: Date | null = null;
      if (sent) {
        sentAt = new Date();
        await pgDb
          .update(businesses)
          .set({ compedWelcomeEmailSentAt: sentAt })
          .where(eq(businesses.id, bizId));
      }

      res.json({ ok: true, sent, recipientEmail, sentAt });
    } catch (err) {
      console.error("Admin comp resend welcome error:", err);
      res.status(500).json({ message: "Failed to resend welcome email" });
    }
  });

  app.post("/api/admin/businesses/sync-stripe-tiers", isAuthenticated, async (req: any, res) => {
    try {
      const adminId = req.user?.id;
      const adminCheck = await isAdminUser(adminId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const stripe = (await import("stripe")).default;
      const stripeClient = new stripe(process.env.Stripeintegration || "");

      const allBiz = await pgDb.select({
        id: businesses.id,
        name: businesses.name,
        membershipTier: businesses.membershipTier,
        stripeSubscriptionId: businesses.stripeSubscriptionId,
        goldTrialEndDate: businesses.goldTrialEndDate,
        originalMembershipTier: businesses.originalMembershipTier,
      }).from(businesses);

      const results: Array<{ id: number; name: string; before: any; after: any; changed: boolean; note?: string }> = [];

      for (const b of allBiz) {
        if (!b.stripeSubscriptionId) {
          results.push({ id: b.id, name: b.name, before: null, after: null, changed: false, note: "No Stripe subscription" });
          continue;
        }
        try {
          const sub = await stripeClient.subscriptions.retrieve(b.stripeSubscriptionId);
          const isAutoUpgrade = sub.metadata?.isAutoUpgrade === "true";
          const originalTier = sub.metadata?.originalTier as string | undefined;
          const subTier = sub.metadata?.tier as string | undefined;

          const updates: any = {};
          let note = "";

          if (subTier && subTier !== b.membershipTier && (sub.status === "active" || sub.status === "trialing")) {
            updates.membershipTier = subTier;
            note += `tier: ${b.membershipTier} → ${subTier}; `;
          }

          if (isAutoUpgrade && originalTier && sub.trial_end && sub.status === "trialing") {
            const newTrialEnd = new Date(sub.trial_end * 1000);
            const beforeTime = b.goldTrialEndDate ? new Date(b.goldTrialEndDate as any).getTime() : 0;
            if (beforeTime !== newTrialEnd.getTime() || b.originalMembershipTier !== originalTier) {
              updates.goldTrialEndDate = newTrialEnd;
              updates.originalMembershipTier = originalTier;
              note += `trial restored from Stripe: ${originalTier}→Gold ends ${newTrialEnd.toISOString().slice(0,10)}; `;
            }
          } else if (isAutoUpgrade && originalTier && sub.status === "active") {
            const currentTier = updates.membershipTier ?? b.membershipTier;
            if (currentTier === "premium") {
              updates.membershipTier = originalTier;
              updates.goldTrialEndDate = null;
              updates.originalMembershipTier = null;
              note += `trial ended → reverted to ${originalTier} (recovered from Stripe metadata); `;
            } else if (b.goldTrialEndDate || b.originalMembershipTier) {
              updates.goldTrialEndDate = null;
              updates.originalMembershipTier = null;
              note += "cleared post-trial fields; ";
            }
          } else if (!isAutoUpgrade && (b.goldTrialEndDate || b.originalMembershipTier)) {
            updates.goldTrialEndDate = null;
            updates.originalMembershipTier = null;
            note += "cleared stale trial (sub not auto-upgrade); ";
          }

          if (Object.keys(updates).length > 0) {
            await pgDb.update(businesses).set(updates).where(eq(businesses.id, b.id));
            results.push({
              id: b.id,
              name: b.name,
              before: { tier: b.membershipTier, trialEnd: b.goldTrialEndDate, originalTier: b.originalMembershipTier },
              after: { ...updates },
              changed: true,
              note: note.trim(),
            });
          } else {
            results.push({ id: b.id, name: b.name, before: null, after: null, changed: false, note: `synced (no changes), sub=${sub.status}, autoUpgrade=${isAutoUpgrade}` });
          }
        } catch (e: any) {
          results.push({ id: b.id, name: b.name, before: null, after: null, changed: false, note: `Stripe error: ${e?.message}` });
        }
      }

      const changedCount = results.filter(r => r.changed).length;
      console.log(`[ADMIN-SYNC] Stripe tier sync: ${changedCount} businesses updated of ${results.length}`);
      res.json({ total: results.length, changed: changedCount, results });
    } catch (err: any) {
      console.error("Admin sync Stripe tiers error:", err);
      res.status(500).json({ message: err?.message || "Failed to sync Stripe tiers" });
    }
  });

  app.get("/api/admin/pending-counts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const adminCheck = await isAdminUser(userId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const safeCount = async (query: Promise<any[]>) => {
        try { const r = await query; return r?.[0]?.count ?? 0; } catch { return 0; }
      };

      const pendingAds = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(adPlacements).where(eq(adPlacements.status, "pending")));
      const pendingEvents = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(events).where(eq(events.status, "pending")));
      const pendingCategories = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(categoryRequests).where(eq(categoryRequests.status, "pending")));

      const total = pendingAds + pendingEvents + pendingCategories;
      res.json({ total, pendingAds, pendingEvents, pendingCategories });
    } catch (err) {
      console.error("Error fetching pending counts:", err);
      res.status(500).json({ message: "Failed to fetch pending counts" });
    }
  });

  app.get("/api/admin/quote-requests", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const adminCheck = await isAdminUser(userId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const requests = await pgDb.select().from(quoteRequests).orderBy(desc(quoteRequests.createdAt));

      const enriched = await Promise.all(requests.map(async (r) => {
        const customerResult = await pgDb.select({ firstName: users.firstName, lastName: users.lastName })
          .from(users).where(eq(users.id, r.userId)).limit(1);
        const customer = customerResult[0];
        const quoteCountResult = await pgDb.select({ count: quotes.id }).from(quotes)
          .where(eq(quotes.requestId, r.id));
        return {
          ...r,
          customerName: customer ? `${customer.firstName || ""} ${customer.lastName || ""}`.trim() : "Unknown",
          quoteCount: quoteCountResult.length,
        };
      }));

      res.json(enriched);
    } catch (err) {
      console.error("Error fetching admin quote requests:", err);
      res.status(500).json({ message: "Failed to fetch quote requests" });
    }
  });

  // Admin growth dashboard: referral leaderboard + founding members roster.
  app.get("/api/admin/referrals/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const adminCheck = await isAdminUser(userId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const { referrals } = await import("@shared/schema");
      const FOUNDING_LIMIT = 100;

      const [{ totalReferrals = 0 } = {}] = await pgDb
        .select({ totalReferrals: sql<number>`count(*)::int` })
        .from(referrals);
      const [{ rewardedReferrals = 0 } = {}] = await pgDb
        .select({ rewardedReferrals: sql<number>`count(*)::int` })
        .from(referrals)
        .where(eq(referrals.status, "rewarded"));
      // Pending must NOT include voided rows — they're explicitly retired.
      // Computed as `pending + processing` rather than `total - rewarded`
      // so the addition of new statuses (e.g. 'void') doesn't silently
      // inflate the pending count.
      const [{ pendingReferrals = 0 } = {}] = await pgDb
        .select({ pendingReferrals: sql<number>`count(*)::int` })
        .from(referrals)
        .where(inArray(referrals.status, ["pending", "processing"]));
      const [{ voidedReferrals = 0 } = {}] = await pgDb
        .select({ voidedReferrals: sql<number>`count(*)::int` })
        .from(referrals)
        .where(eq(referrals.status, "void"));

      // Top referrers (by rewarded count, then total)
      const referrerRows = await pgDb
        .select({
          businessId: referrals.referrerBusinessId,
          rewarded: sql<number>`sum(case when ${referrals.status} = 'rewarded' then 1 else 0 end)::int`,
          total: sql<number>`count(*)::int`,
        })
        .from(referrals)
        .groupBy(referrals.referrerBusinessId);

      const referrerIds = referrerRows.map((r) => r.businessId).filter(Boolean) as number[];
      const referrerBizMap = new Map<number, string>();
      if (referrerIds.length > 0) {
        const refBizRows = await pgDb
          .select({ id: businesses.id, name: businesses.name })
          .from(businesses)
          .where(inArray(businesses.id, referrerIds));
        refBizRows.forEach((b) => referrerBizMap.set(b.id, b.name));
      }
      const leaderboard = referrerRows
        .map((r) => ({
          businessId: r.businessId,
          businessName: referrerBizMap.get(r.businessId as number) ?? `Business #${r.businessId}`,
          rewarded: r.rewarded,
          total: r.total,
        }))
        .sort((a, b) => b.rewarded - a.rewarded || b.total - a.total)
        .slice(0, 20);

      // Founding members roster
      const founders = await pgDb
        .select({
          id: businesses.id,
          name: businesses.name,
          membershipTier: businesses.membershipTier,
          foundingMemberNumber: businesses.foundingMemberNumber,
        })
        .from(businesses)
        .where(eq(businesses.isFoundingMember, true))
        .orderBy(businesses.foundingMemberNumber);

      res.json({
        totals: {
          totalReferrals,
          rewardedReferrals,
          pendingReferrals,
          voidedReferrals,
        },
        founding: {
          limit: FOUNDING_LIMIT,
          claimed: founders.length,
          remaining: Math.max(0, FOUNDING_LIMIT - founders.length),
          members: founders,
        },
        leaderboard,
      });
    } catch (err) {
      console.error("Admin referrals stats error:", err);
      res.status(500).json({ message: "Failed to load referral stats" });
    }
  });

  // Admin: grant a business "Founding Member" status. Auto-assigns the next
  // available founding member number (1..FOUNDING_LIMIT). Idempotent — if
  // the business is already a founding member, returns the existing number
  // unchanged. Used by the Founding Members Roster card on the admin
  // dashboard so we can manually flag businesses that signed up before the
  // founding-member referral pipeline existed (Boun's own Blackwater Tech
  // Solutions and GOAT LOCKER PRINTING are the canonical examples).
  app.post("/api/admin/businesses/:id/grant-founding-member", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!(await isAdminUser(userId))) return res.status(403).json({ message: "Forbidden" });

      const bizId = parseInt(req.params.id);
      if (isNaN(bizId)) return res.status(400).json({ message: "Invalid business ID" });

      const FOUNDING_LIMIT = 100;

      // Wrap the entire read-then-write in a transaction guarded by a
      // Postgres advisory lock keyed to a constant for this operation.
      // Without this, two admins clicking "Grant" simultaneously would
      // both pass the `isFoundingMember` early-return AND both compute
      // the same `MAX + 1`, ending up either with two businesses sharing
      // a number or one business having its number overwritten (burning
      // a slot). The advisory lock auto-releases at end of transaction.
      // Constant 0xF0D14 (chosen arbitrarily; doesn't collide with any
      // other advisory lock in the codebase).
      const result = await pgDb.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(986388)`);

        const [target] = await tx
          .select({
            id: businesses.id,
            name: businesses.name,
            isFoundingMember: businesses.isFoundingMember,
            foundingMemberNumber: businesses.foundingMemberNumber,
          })
          .from(businesses)
          .where(eq(businesses.id, bizId));
        if (!target) {
          return { kind: "not_found" as const };
        }

        if (target.isFoundingMember && target.foundingMemberNumber) {
          return {
            kind: "already" as const,
            foundingMemberNumber: target.foundingMemberNumber,
            name: target.name,
          };
        }

        const [maxRow] = await tx
          .select({
            maxNum: sql<number>`COALESCE(MAX(${businesses.foundingMemberNumber}), 0)`,
          })
          .from(businesses)
          .where(eq(businesses.isFoundingMember, true));
        const nextNum = (maxRow?.maxNum ?? 0) + 1;
        if (nextNum > FOUNDING_LIMIT) {
          return { kind: "full" as const };
        }

        await tx
          .update(businesses)
          .set({ isFoundingMember: true, foundingMemberNumber: nextNum })
          .where(eq(businesses.id, bizId));

        return { kind: "granted" as const, foundingMemberNumber: nextNum, name: target.name };
      });

      if (result.kind === "not_found") {
        return res.status(404).json({ message: "Business not found" });
      }
      if (result.kind === "full") {
        return res.status(409).json({ message: `Founding member roster is full (${FOUNDING_LIMIT}/${FOUNDING_LIMIT}).` });
      }
      if (result.kind === "already") {
        return res.json({
          ok: true,
          alreadyFoundingMember: true,
          foundingMemberNumber: result.foundingMemberNumber,
          name: result.name,
        });
      }

      console.log(
        `[admin] granted founding-member #${result.foundingMemberNumber} to business ${bizId} (${result.name}) by admin ${userId}`,
      );
      res.json({ ok: true, foundingMemberNumber: result.foundingMemberNumber, name: result.name });
    } catch (err) {
      console.error("Grant founding member error:", err);
      res.status(500).json({ message: "Failed to grant founding member status" });
    }
  });

  // Admin: revoke a business's Founding Member status. Used to undo a mistake;
  // the freed slot becomes the next-assigned number on the next grant.
  app.post("/api/admin/businesses/:id/revoke-founding-member", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!(await isAdminUser(userId))) return res.status(403).json({ message: "Forbidden" });

      const bizId = parseInt(req.params.id);
      if (isNaN(bizId)) return res.status(400).json({ message: "Invalid business ID" });

      const [target] = await pgDb
        .select({ id: businesses.id, name: businesses.name, foundingMemberNumber: businesses.foundingMemberNumber })
        .from(businesses)
        .where(eq(businesses.id, bizId));
      if (!target) return res.status(404).json({ message: "Business not found" });

      await pgDb
        .update(businesses)
        .set({ isFoundingMember: false, foundingMemberNumber: null })
        .where(eq(businesses.id, bizId));

      console.log(`[admin] revoked founding-member #${target.foundingMemberNumber} from business ${bizId} (${target.name}) by admin ${userId}`);
      res.json({ ok: true });
    } catch (err) {
      console.error("Revoke founding member error:", err);
      res.status(500).json({ message: "Failed to revoke founding member status" });
    }
  });

  // Admin: full list of referrals with referrer/referred names + status,
  // for spotting failed Stripe credits and manually re-issuing them.
  app.get("/api/admin/referrals", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!(await isAdminUser(userId))) return res.status(403).json({ message: "Forbidden" });

      const { referrals } = await import("@shared/schema");
      const statusFilter = typeof req.query.status === "string" ? req.query.status : null;

      const whereClause = statusFilter && statusFilter !== "all"
        ? eq(referrals.status, statusFilter)
        : undefined;

      const rows = whereClause
        ? await pgDb.select().from(referrals).where(whereClause).orderBy(desc(referrals.createdAt))
        : await pgDb.select().from(referrals).orderBy(desc(referrals.createdAt));

      const bizIds = Array.from(new Set(rows.flatMap((r) => [r.referrerBusinessId, r.referredBusinessId])));
      const bizMap = new Map<number, { name: string; tier: string | null; hasStripe: boolean }>();
      if (bizIds.length > 0) {
        const bizRows = await pgDb
          .select({
            id: businesses.id,
            name: businesses.name,
            membershipTier: businesses.membershipTier,
            stripeCustomerId: businesses.stripeCustomerId,
          })
          .from(businesses)
          .where(inArray(businesses.id, bizIds));
        bizRows.forEach((b) =>
          bizMap.set(b.id, {
            name: b.name,
            tier: b.membershipTier,
            hasStripe: !!b.stripeCustomerId,
          }),
        );
      }

      // Estimated monthly credit (cents) based on referrer's current tier — used
      // for the column display when we don't have the actual issued amount stored.
      const TIER_CENTS: Record<string, number> = { basic: 2500, standard: 5000, premium: 10000 };

      const enriched = rows.map((r) => {
        const referrer = bizMap.get(r.referrerBusinessId);
        const referred = bizMap.get(r.referredBusinessId);
        const estimatedCreditCents = TIER_CENTS[referrer?.tier ?? ""] ?? null;
        return {
          id: r.id,
          code: r.code,
          status: r.status,
          createdAt: r.createdAt,
          rewardedAt: r.rewardedAt,
          referrerBusinessId: r.referrerBusinessId,
          referrerBusinessName: referrer?.name ?? `Business #${r.referrerBusinessId}`,
          referrerHasStripeCustomer: referrer?.hasStripe ?? false,
          referrerTier: referrer?.tier ?? null,
          referredBusinessId: r.referredBusinessId,
          referredBusinessName: referred?.name ?? `Business #${r.referredBusinessId}`,
          // Real cents persisted at issue-time. Null on legacy rows or rows
          // that haven't been rewarded yet — UI falls back to estimate.
          creditAmountCents: r.creditAmountCents ?? null,
          estimatedCreditCents,
        };
      });

      res.json(enriched);
    } catch (err) {
      console.error("Admin referrals list error:", err);
      res.status(500).json({ message: "Failed to load referrals" });
    }
  });

  // Admin: manually issue (or re-issue) the Stripe credit for a referral row.
  // Use case: original webhook-triggered credit failed (e.g. transient Stripe
  // error) and the operator needs to recover the reward without waiting on
  // another payment event.
  app.post("/api/admin/referrals/:id/issue-credit", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!(await isAdminUser(userId))) return res.status(403).json({ message: "Forbidden" });

      const referralId = parseInt(req.params.id, 10);
      if (!Number.isFinite(referralId)) return res.status(400).json({ message: "Invalid referral id" });

      // Optional admin override: a custom credit amount in cents. Used for
      // edge cases the auto-calc can't handle (partial refunds, tier
      // mid-cycle upgrades, goodwill bumps). Range-checked so a fat-finger
      // can't issue $10,000. 0 is rejected because that would be a no-op
      // posing as a credit; use the dedicated void route instead.
      let customCents: number | undefined;
      const rawCustom = req.body?.customCents;
      if (rawCustom !== undefined && rawCustom !== null && rawCustom !== "") {
        const parsed = typeof rawCustom === "string" ? parseInt(rawCustom, 10) : Number(rawCustom);
        if (!Number.isFinite(parsed) || parsed <= 0 || parsed > 100000) {
          return res.status(400).json({
            message: "customCents must be a positive integer between 1 and 100000 (i.e. $0.01 – $1000.00)",
          });
        }
        customCents = parsed;
      }

      const { referrals } = await import("@shared/schema");
      const [row] = await pgDb.select().from(referrals).where(eq(referrals.id, referralId));
      if (!row) return res.status(404).json({ message: "Referral not found" });

      // Status precondition: refuse to issue credit on a voided row. The
      // operator must explicitly un-void (or create a new referral) first.
      // Without this guard, an admin could re-flip status='void' → 'rewarded'
      // and silently re-charge the platform.
      if (row.status === "void") {
        return res.status(409).json({
          message:
            "Cannot issue credit on a voided referral. If this was a mistake, contact engineering to restore the row.",
          code: "REFERRAL_VOIDED",
        });
      }

      const parties = await pgDb
        .select({
          id: businesses.id,
          name: businesses.name,
          membershipTier: businesses.membershipTier,
          stripeCustomerId: businesses.stripeCustomerId,
          stripeSubscriptionId: businesses.stripeSubscriptionId,
        })
        .from(businesses)
        .where(inArray(businesses.id, [row.referrerBusinessId, row.referredBusinessId]));
      const referrer = parties.find((p) => p.id === row.referrerBusinessId);
      const referred = parties.find((p) => p.id === row.referredBusinessId);
      if (!referrer || !referred) return res.status(404).json({ message: "Referral parties missing" });

      if (!referrer.stripeCustomerId) {
        return res.status(400).json({
          message: "Referrer has no Stripe customer (founder/comp account). Cannot issue Stripe credit.",
        });
      }

      const stripeKey = process.env.Stripeintegration;
      if (!stripeKey) return res.status(500).json({ message: "Stripe not configured" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(stripeKey, { apiVersion: "2025-02-24.acacia" as any });

      // Compute monthly-equivalent credit from the referrer's current sub —
      // unless the admin explicitly overrode the amount, in which case we
      // use that and skip the Stripe lookup entirely.
      const TIER_CENTS_FALLBACK: Record<string, number> = { basic: 2500, standard: 5000, premium: 10000 };
      let creditCents = 0;
      if (customCents !== undefined) {
        creditCents = customCents;
      } else {
        if (referrer.stripeSubscriptionId) {
          try {
            const sub = await stripe.subscriptions.retrieve(referrer.stripeSubscriptionId);
            const item = sub.items?.data?.[0];
            const unit = item?.price?.unit_amount;
            const recurring = item?.price?.recurring;
            if (typeof unit === "number" && unit > 0 && recurring) {
              const intervalCount = recurring.interval_count || 1;
              const monthsPerInterval =
                recurring.interval === "year" ? 12 :
                recurring.interval === "month" ? 1 :
                recurring.interval === "week" ? 1 / 4 :
                recurring.interval === "day" ? 1 / 30 : 1;
              const totalMonths = intervalCount * monthsPerInterval;
              creditCents = totalMonths > 0 ? Math.round(unit / totalMonths) : unit;
            }
          } catch (err: any) {
            console.warn(`[admin issue-credit] could not fetch sub ${referrer.stripeSubscriptionId}:`, err?.message);
          }
        }
        if (!creditCents) {
          creditCents = TIER_CENTS_FALLBACK[referrer.membershipTier ?? ""] ?? 5000;
        }
      }

      // Use a manual-issue idempotency key distinct from the webhook key so
      // operators CAN issue the credit even if the original webhook attempt
      // already burned the auto key. Date-stamped so repeat manual clicks on
      // the same day are deduped but the operator can retry tomorrow.
      const idemKey = `referral-credit-manual-${referralId}-${new Date().toISOString().slice(0, 10)}`;
      const txn = await stripe.customers.createBalanceTransaction(
        referrer.stripeCustomerId,
        {
          amount: -creditCents,
          currency: "usd",
          description: `Referral reward (manual): ${referred.name} (referral #${referralId})`,
          metadata: {
            referralId: String(referralId),
            referredBusinessId: String(row.referredBusinessId),
            referrerBusinessId: String(row.referrerBusinessId),
            source: "locallist365_referral_manual",
            issuedByAdminId: String(userId ?? ""),
          },
        },
        { idempotencyKey: idemKey },
      );

      // Conditional update so a concurrent void (which lands AFTER our
      // pre-check above but BEFORE this write) doesn't get silently
      // overwritten back to 'rewarded'. If the row was voided in the
      // meantime, the Stripe credit is already issued — surface that
      // explicitly so the operator knows to refund it manually.
      const updated = await pgDb
        .update(referrals)
        .set({ status: "rewarded", rewardedAt: new Date(), creditAmountCents: creditCents })
        .where(and(eq(referrals.id, referralId), sql`${referrals.status} != 'void'`))
        .returning({ id: referrals.id });

      if (updated.length === 0) {
        console.warn(
          `[admin issue-credit] CONCURRENT VOID — referral ${referralId} was voided after our status check; Stripe credit ${txn.id} (${creditCents}¢) was already issued and must be refunded manually in Stripe console (admin ${userId})`,
        );
        return res.status(409).json({
          message:
            "Referral was voided concurrently. Stripe credit was issued but the referral row remains 'void'. Refund the balance transaction manually.",
          code: "REFERRAL_VOIDED_AFTER_CREDIT",
          balanceTransactionId: txn.id,
          creditCents,
        });
      }

      console.log(
        `[admin issue-credit] $${(creditCents / 100).toFixed(2)} credited to ${referrer.stripeCustomerId} for referral ${referralId} by admin ${userId}${customCents !== undefined ? " (custom amount override)" : ""}`,
      );
      res.json({ ok: true, creditCents, balanceTransactionId: txn.id });
    } catch (err: any) {
      console.error("Admin issue-credit error:", err);
      res.status(500).json({ message: err?.message || "Failed to issue credit" });
    }
  });

  // Admin: void a referral row. Use case: duplicate referral, fraud,
  // referee chargeback, or any other reason the credit should not stand.
  // Flips status to 'void' (not 'rewarded') so:
  //   - The row is excluded from the referrer's lifetime credit total
  //   - It still shows up in admin history with a clear status
  //   - The unique (referredBusinessId) constraint still blocks future
  //     duplicate referrals for the same business — voiding does NOT
  //     allow re-creating the link
  // Idempotent: voiding an already-void row succeeds quietly.
  // Does NOT clawback any Stripe credit already issued — that has to be
  // refunded manually via the Stripe console (we surface the prior
  // creditAmountCents in the audit log so the operator knows what to undo).
  app.post("/api/admin/referrals/:id/void", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      if (!(await isAdminUser(userId))) return res.status(403).json({ message: "Forbidden" });

      const referralId = parseInt(req.params.id, 10);
      if (!Number.isFinite(referralId)) return res.status(400).json({ message: "Invalid referral id" });

      const { referrals } = await import("@shared/schema");
      const [row] = await pgDb.select().from(referrals).where(eq(referrals.id, referralId));
      if (!row) return res.status(404).json({ message: "Referral not found" });

      const priorStatus = row.status;
      const priorCents = row.creditAmountCents;

      // Idempotent: voiding an already-void row is a quiet no-op (no
      // re-log, no DB write). Returning 200 here matches REST norms for
      // idempotent operations — the operator's intent (row should be void)
      // is satisfied either way.
      if (priorStatus === "void") {
        return res.json({ ok: true, priorStatus, priorCreditCents: priorCents, alreadyVoid: true });
      }

      // Per spec: zero out creditAmountCents and stamp rewardedAt so the row
      // can't be confused with a real payout. The prior credit amount and
      // status are preserved in the audit console.log below for forensics.
      await pgDb
        .update(referrals)
        .set({
          status: "void",
          creditAmountCents: 0,
          rewardedAt: new Date(),
        })
        .where(eq(referrals.id, referralId));

      console.log(
        `[admin referral void] referral ${referralId} voided by admin ${userId} (was status=${priorStatus}, creditCents=${priorCents ?? "—"})`,
      );
      res.json({ ok: true, priorStatus, priorCreditCents: priorCents });
    } catch (err: any) {
      console.error("Admin referral void error:", err);
      res.status(500).json({ message: err?.message || "Failed to void referral" });
    }
  });

  app.get("/api/admin/stats", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const adminCheck = await isAdminUser(userId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const safeCount = async (query: Promise<any[]>) => {
        try { const r = await query; return r?.[0]?.count ?? 0; } catch { return 0; }
      };

      const totalUsersCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(users));
      const totalBusinessesCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(businesses));
      const totalEventsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(events));
      const totalJobsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(jobListings).where(eq(jobListings.isActive, true)));
      const totalPostsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(postsTable));
      const totalQuoteRequestsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(quoteRequests));
      const totalQuotesCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(quotes));
      const totalAdsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(adPlacements));
      const activeAdsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(adPlacements).where(eq(adPlacements.status, "active")));
      const pendingAdsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(adPlacements).where(eq(adPlacements.status, "pending")));
      const totalPromosCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(promoCodes));
      const usedPromosCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(promoCodeUsages));
      const pendingCategoriesCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(categoryRequests).where(eq(categoryRequests.status, "pending")));
      const pendingEventsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(events).where(eq(events.status, "pending")));
      const unverifiedBusinessesCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(businesses).where(eq(businesses.verified, false)));
      const downgradesCountVal = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(membershipDowngrades));
      const customerAccountsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.accountType, "customer")));
      const businessAccountsCount = await safeCount(pgDb.select({ count: sql<number>`count(*)::int` }).from(users).where(eq(users.accountType, "business")));

      let tierCounts: Array<{ tier: string | null; count: number }> = [];
      try {
        tierCounts = await pgDb.select({
          tier: businesses.membershipTier,
          count: sql<number>`count(*)::int`,
        }).from(businesses).groupBy(businesses.membershipTier);
      } catch {}

      let recentUsers: any[] = [];
      try {
        recentUsers = await pgDb.select({
          id: users.id, email: users.email, firstName: users.firstName,
          lastName: users.lastName, accountType: users.accountType, createdAt: users.createdAt,
        }).from(users).orderBy(desc(users.createdAt)).limit(10);
      } catch {}

      let recentBusinesses: any[] = [];
      try {
        recentBusinesses = await pgDb.select({
          id: businesses.id, name: businesses.name, membershipTier: businesses.membershipTier,
          verified: businesses.verified, createdAt: businesses.createdAt,
        }).from(businesses).orderBy(desc(businesses.createdAt)).limit(10);
      } catch {}

      let recentQuoteRequests: any[] = [];
      try {
        recentQuoteRequests = await pgDb.select({
          id: quoteRequests.id, title: quoteRequests.title, status: quoteRequests.status, createdAt: quoteRequests.createdAt,
        }).from(quoteRequests).orderBy(desc(quoteRequests.createdAt)).limit(10);
      } catch {}

      let recentAds: any[] = [];
      try {
        recentAds = await pgDb.select({
          id: adPlacements.id, title: adPlacements.title, status: adPlacements.status,
          placement: adPlacements.placement, createdAt: adPlacements.createdAt,
        }).from(adPlacements).orderBy(desc(adPlacements.createdAt)).limit(10);
      } catch {}

      // Revenue breakdown — derive from shared/config/membership.ts so admin
      // metrics stay in sync with what Stripe charges. Keys here use the DB
      // tier ids (basic/standard/premium); MEMBERSHIP_TIERS uses display ids
      // (bronze/silver/gold), so map them via DB_TIER_TO_DISPLAY.
      const TIER_DB_KEYS: Record<string, string> = { bronze: "basic", silver: "standard", gold: "premium" };
      const cents = (n: number) => Math.round(n * 100);
      const SUBSCRIPTION_MONTHLY: Record<string, number> = Object.fromEntries(
        MEMBERSHIP_TIERS.map((t) => [TIER_DB_KEYS[t.id] ?? t.id, cents(t.monthlyPrice)]),
      );
      const SUBSCRIPTION_SEMI: Record<string, number> = Object.fromEntries(
        MEMBERSHIP_TIERS.map((t) => [TIER_DB_KEYS[t.id] ?? t.id, cents(t.semiAnnualPrice)]),
      );
      const SUBSCRIPTION_ANNUAL: Record<string, number> = Object.fromEntries(
        MEMBERSHIP_TIERS.map((t) => [TIER_DB_KEYS[t.id] ?? t.id, cents(t.annualPrice)]),
      );

      const blankTierBreakdown = () => ({
        bronze: { count: 0, monthly: 0 },
        silver: { count: 0, monthly: 0 },
        gold: { count: 0, monthly: 0 },
        total: 0,
      });
      let subscriptionRevenue = {
        realized: blankTierBreakdown(),
        projected: blankTierBreakdown(),
        trialingCount: 0,
        founderCount: 0,
      };
      try {
        const activeSubs = await pgDb.select({
          id: businesses.id,
          name: businesses.name,
          membershipTier: businesses.membershipTier,
          paymentFrequency: businesses.membershipPaymentFrequency,
          goldTrialEndDate: businesses.goldTrialEndDate,
          originalMembershipTier: businesses.originalMembershipTier,
          stripeSubscriptionId: businesses.stripeSubscriptionId,
        }).from(businesses).where(
          and(
            sql`${businesses.membershipTier} IS NOT NULL`,
            sql`${businesses.membershipTier} != 'none'`
          )
        );
        const now = new Date();
        const tierToKey = (t: string | null) => t === "basic" ? "bronze" : t === "standard" ? "silver" : t === "premium" ? "gold" : null;
        const monthlyForTier = (t: string, freq: string) => {
          if (freq === "semi_annual") return Math.round((SUBSCRIPTION_SEMI[t] || 0) / 6);
          if (freq === "annual") return Math.round((SUBSCRIPTION_ANNUAL[t] || 0) / 12);
          return SUBSCRIPTION_MONTHLY[t] || 0;
        };

        // Lazy-load Stripe for live trial-status detection
        let stripeClient: any = null;
        try {
          if (process.env.Stripeintegration) {
            const Stripe = (await import("stripe")).default;
            stripeClient = new Stripe(process.env.Stripeintegration as string, { apiVersion: "2025-02-24.acacia" as any });
          }
        } catch {}

        for (const sub of activeSubs) {
          // Founder businesses are permanently free — exclude from both realized and projected.
          if (isFounderBusiness(sub.name)) {
            subscriptionRevenue.founderCount++;
            continue;
          }
          if (!sub.stripeSubscriptionId) continue; // No Stripe sub = not actually billing.

          const freq = sub.paymentFrequency || "monthly";

          // Live trial check + actual Stripe price (most accurate; covers cases where
          // originalMembershipTier wasn't recorded locally).
          let inTrial = sub.goldTrialEndDate ? new Date(sub.goldTrialEndDate) > now : false;
          let liveMonthlyCents: number | null = null;
          let liveTierKey: "bronze" | "silver" | "gold" | null = null;
          if (stripeClient) {
            try {
              const liveSub = await stripeClient.subscriptions.retrieve(sub.stripeSubscriptionId);
              if (liveSub?.status === "trialing") inTrial = true;
              else if (liveSub?.status === "active" || liveSub?.status === "past_due") inTrial = false;
              const price = liveSub?.items?.data?.[0]?.price;
              if (price?.unit_amount && price?.recurring) {
                const unit = price.unit_amount as number;
                const interval = price.recurring.interval;
                const intervalCount = price.recurring.interval_count || 1;
                if (interval === "year") liveMonthlyCents = Math.round(unit / 12);
                else if (interval === "month") liveMonthlyCents = Math.round(unit / intervalCount);
                else if (interval === "week") liveMonthlyCents = Math.round((unit * 52) / 12 / intervalCount);
                else if (interval === "day") liveMonthlyCents = Math.round((unit * 365) / 12 / intervalCount);
                if (liveMonthlyCents !== null) {
                  if (liveMonthlyCents <= 7000) liveTierKey = "bronze";
                  else if (liveMonthlyCents <= 14000) liveTierKey = "silver";
                  else liveTierKey = "gold";
                }
              }
            } catch {}
          }

          const fallbackPostTrialTier = sub.originalMembershipTier || sub.membershipTier || "none";
          const fallbackPostTrialKey = tierToKey(fallbackPostTrialTier);
          const projKey = liveTierKey || fallbackPostTrialKey;
          const projMonthly = liveMonthlyCents !== null
            ? liveMonthlyCents
            : (fallbackPostTrialKey ? monthlyForTier(fallbackPostTrialTier, freq) : 0);
          if (projKey) {
            subscriptionRevenue.projected[projKey].count++;
            subscriptionRevenue.projected[projKey].monthly += projMonthly;
          }
          if (inTrial) {
            subscriptionRevenue.trialingCount++;
          } else {
            // Active billing — use live Stripe amount when available, else fall back to local tier
            const billKey = liveTierKey || tierToKey(sub.membershipTier);
            const billMonthly = liveMonthlyCents !== null
              ? liveMonthlyCents
              : (sub.membershipTier ? monthlyForTier(sub.membershipTier, freq) : 0);
            if (billKey) {
              subscriptionRevenue.realized[billKey].count++;
              subscriptionRevenue.realized[billKey].monthly += billMonthly;
            }
          }
        }
        subscriptionRevenue.realized.total = subscriptionRevenue.realized.bronze.monthly + subscriptionRevenue.realized.silver.monthly + subscriptionRevenue.realized.gold.monthly;
        subscriptionRevenue.projected.total = subscriptionRevenue.projected.bronze.monthly + subscriptionRevenue.projected.silver.monthly + subscriptionRevenue.projected.gold.monthly;
      } catch {}

      const blankAdBreakdown = () => ({
        small: { count: 0, revenue: 0 },
        medium: { count: 0, revenue: 0 },
        large: { count: 0, revenue: 0 },
        total: 0,
      });
      let adRevenue = {
        realized: blankAdBreakdown(),
        projected: blankAdBreakdown(),
        unpaidActiveCount: 0,
        totalPaid: 0,
      };
      try {
        const AD_MONTHLY: Record<string, number> = { small: 25000, medium: 50000, large: 100000 };
        const projectedRows = await pgDb.select({
          adSize: adPlacements.adSize,
          count: sql<number>`count(*)::int`,
        }).from(adPlacements).where(eq(adPlacements.status, "active")).groupBy(adPlacements.adSize);
        for (const row of projectedRows) {
          const size = (row.adSize || "small") as "small" | "medium" | "large";
          if (adRevenue.projected[size]) {
            adRevenue.projected[size].count = row.count;
            adRevenue.projected[size].revenue = row.count * (AD_MONTHLY[size] || 25000);
          }
        }
        adRevenue.projected.total = adRevenue.projected.small.revenue + adRevenue.projected.medium.revenue + adRevenue.projected.large.revenue;

        const realizedRows = await pgDb.select({
          adSize: adPlacements.adSize,
          count: sql<number>`count(*)::int`,
        }).from(adPlacements).where(and(
          eq(adPlacements.status, "active"),
          eq(adPlacements.paymentStatus, "paid"),
          sql`${adPlacements.totalPaid} > 0`
        )).groupBy(adPlacements.adSize);
        for (const row of realizedRows) {
          const size = (row.adSize || "small") as "small" | "medium" | "large";
          if (adRevenue.realized[size]) {
            adRevenue.realized[size].count = row.count;
            adRevenue.realized[size].revenue = row.count * (AD_MONTHLY[size] || 25000);
          }
        }
        adRevenue.realized.total = adRevenue.realized.small.revenue + adRevenue.realized.medium.revenue + adRevenue.realized.large.revenue;

        const projectedActive = adRevenue.projected.small.count + adRevenue.projected.medium.count + adRevenue.projected.large.count;
        const realizedActive = adRevenue.realized.small.count + adRevenue.realized.medium.count + adRevenue.realized.large.count;
        adRevenue.unpaidActiveCount = Math.max(0, projectedActive - realizedActive);

        const allAdPaid = await pgDb.select({
          totalPaid: sql<number>`COALESCE(sum(${adPlacements.totalPaid}), 0)::int`,
        }).from(adPlacements);
        adRevenue.totalPaid = allAdPaid[0]?.totalPaid || 0;
      } catch {}

      let jobRevenue = { activeJobs: 0, totalEstimated: 0 };
      try {
        const JOB_PRICES: Record<string, number> = { premium: 1000, standard: 1500, basic: 1800, none: 2000 };
        const activeJobsWithTier = await pgDb.select({
          membershipTier: businesses.membershipTier,
          count: sql<number>`count(*)::int`,
        }).from(jobListings)
          .leftJoin(businesses, eq(jobListings.businessId, businesses.id))
          .where(eq(jobListings.isActive, true))
          .groupBy(businesses.membershipTier);
        for (const row of activeJobsWithTier) {
          const weeklyPrice = JOB_PRICES[row.membershipTier || "none"] || 2000;
          const monthlyEstimate = weeklyPrice * 4;
          jobRevenue.activeJobs += row.count;
          jobRevenue.totalEstimated += row.count * monthlyEstimate;
        }
      } catch {}

      res.json({
        overview: {
          totalUsers: totalUsersCount,
          totalBusinesses: totalBusinessesCount,
          totalEvents: totalEventsCount,
          totalJobs: totalJobsCount,
          totalPosts: totalPostsCount,
          totalQuoteRequests: totalQuoteRequestsCount,
          totalQuotes: totalQuotesCount,
          totalAds: totalAdsCount,
          activeAds: activeAdsCount,
          pendingAds: pendingAdsCount,
          totalPromos: totalPromosCount,
          usedPromos: usedPromosCount,
          pendingCategories: pendingCategoriesCount,
          pendingEvents: pendingEventsCount,
          unverifiedBusinesses: unverifiedBusinessesCount,
          downgradesCount: downgradesCountVal,
          customerAccounts: customerAccountsCount,
          businessAccounts: businessAccountsCount,
        },
        membershipBreakdown: (tierCounts || []).reduce((acc, t) => {
          acc[t.tier || "none"] = t.count;
          return acc;
        }, {} as Record<string, number>),
        revenueBreakdown: {
          subscriptions: subscriptionRevenue,
          ads: adRevenue,
          jobs: jobRevenue,
        },
        recentUsers,
        recentBusinesses,
        recentQuoteRequests,
        recentAds,
      });
    } catch (err) {
      console.error("Admin stats error:", err);
      res.status(500).json({ message: "Failed to fetch admin stats" });
    }
  });

  // Per-zip metrics breakdown — lets admins see WHERE the activity is, so they
  // can decide which towns need more advertising / more outreach. Returns one
  // row per zip we have any business / event activity in (joined to the
  // `locations` table for the city/state label).
  app.get("/api/admin/stats/by-zip", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const adminCheck = await isAdminUser(userId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      // Counts per zip — businesses, active ads (via the businessId → biz.zipCode
      // link), active jobs (same join), quote bids submitted (via quotes.businessId
      // → biz.zipCode link), and raw ad impressions/clicks summed for that zip.
      // Note: `posts` and `quote_requests` aren't directly business-keyed in this
      // schema (posts.author_id → users.id; quote_requests.user_id → users.id),
      // so they're omitted to keep the query honest. `quotes` IS business-keyed
      // and is a better signal of "bidding activity originating from this zip".
      //
      // We pre-aggregate each child table in its own subquery first so SUM()
      // values don't get multiplied by row-fanout when LEFT JOINing multiple
      // child tables to the same business.
      const bizPerZip: any[] = await pgDb.execute(sql`
        SELECT
          b.zip_code AS "zipCode",
          COUNT(DISTINCT b.id) FILTER (WHERE COALESCE(b.status,'active') != 'archived') AS "businesses",
          COUNT(DISTINCT b.id) FILTER (
            WHERE COALESCE(b.status,'active') != 'archived'
              AND b.membership_tier IN ('bronze','silver','gold','premium','standard','basic')
          ) AS "paidBusinesses",
          COALESCE(SUM(ad.active_count), 0)::int AS "activeAds",
          COALESCE(SUM(j.active_count), 0)::int AS "activeJobs",
          COALESCE(SUM(q.bid_count), 0)::int AS "quoteBids",
          COALESCE(SUM(ad.impressions), 0)::int AS "adImpressions",
          COALESCE(SUM(ad.clicks), 0)::int AS "adClicks"
        FROM businesses b
        LEFT JOIN (
          SELECT business_id,
                 COUNT(*) FILTER (WHERE status = 'active') AS active_count,
                 SUM(COALESCE(impressions, 0)) AS impressions,
                 SUM(COALESCE(clicks, 0)) AS clicks
          FROM ad_placements
          GROUP BY business_id
        ) ad ON ad.business_id = b.id
        LEFT JOIN (
          SELECT business_id, COUNT(*) FILTER (WHERE is_active = true) AS active_count
          FROM job_listings
          GROUP BY business_id
        ) j ON j.business_id = b.id
        LEFT JOIN (
          SELECT business_id, COUNT(*) AS bid_count
          FROM quotes
          GROUP BY business_id
        ) q ON q.business_id = b.id
        WHERE b.zip_code IS NOT NULL AND b.zip_code != ''
        GROUP BY b.zip_code
      `).then((r: any) => r.rows ?? r);

      const eventsPerZip: any[] = await pgDb.execute(sql`
        SELECT zip_code AS "zipCode", COUNT(*)::int AS "events"
        FROM events
        WHERE zip_code IS NOT NULL AND zip_code != ''
        GROUP BY zip_code
      `).then((r: any) => r.rows ?? r);

      // Pull the human-readable city/state for each zip from the `locations`
      // seed (zipCodes is an array column, so we unnest).
      const locRows: any[] = await pgDb.execute(sql`
        SELECT z AS "zipCode", city, state, region, name
        FROM locations, UNNEST(zip_codes) AS z
      `).then((r: any) => r.rows ?? r);

      const locByZip = new Map<string, { city: string; state: string; region: string | null; name: string }>();
      for (const r of locRows) {
        if (r.zipCode) locByZip.set(r.zipCode, { city: r.city, state: r.state, region: r.region, name: r.name });
      }

      const eventsByZip = new Map<string, number>();
      for (const r of eventsPerZip) {
        if (r.zipCode) eventsByZip.set(r.zipCode, Number(r.events));
      }

      // Union of all zips that have any kind of activity.
      const allZips = new Set<string>([
        ...bizPerZip.map((r) => r.zipCode).filter(Boolean),
        ...eventsPerZip.map((r) => r.zipCode).filter(Boolean),
      ]);

      const bizMap = new Map<string, any>();
      for (const r of bizPerZip) {
        if (r.zipCode) bizMap.set(r.zipCode, r);
      }

      const rows = Array.from(allZips).map((zip) => {
        const b = bizMap.get(zip) || {};
        const loc = locByZip.get(zip);
        return {
          zipCode: zip,
          city: loc?.city || "",
          state: loc?.state || "",
          region: loc?.region || null,
          locationName: loc?.name || zip,
          businesses: Number(b.businesses || 0),
          paidBusinesses: Number(b.paidBusinesses || 0),
          activeAds: Number(b.activeAds || 0),
          activeJobs: Number(b.activeJobs || 0),
          events: eventsByZip.get(zip) || 0,
          posts: Number(b.posts || 0),
          quoteRequests: Number(b.quoteRequests || 0),
          adImpressions: Number(b.adImpressions || 0),
          adClicks: Number(b.adClicks || 0),
        };
      });

      // Sort by total activity desc so the most-active zips bubble to the top
      // of the table (= where to focus retention; bottom = where to advertise).
      rows.sort((a, b) => {
        const aTotal = a.businesses + a.activeAds + a.events + a.activeJobs + a.quoteBids;
        const bTotal = b.businesses + b.activeAds + b.events + b.activeJobs + b.quoteBids;
        return bTotal - aTotal;
      });

      res.json({ rows });
    } catch (err) {
      console.error("Admin per-zip stats error:", err);
      res.status(500).json({ message: "Failed to fetch per-zip stats" });
    }
  });

  // ============ TRAFFIC ANALYTICS ============
  // Powers the admin "Traffic" tab: requests over time, top URLs, top
  // referrers, HTTP status breakdown, duration histogram, unique IPs.
  // Source data is the request_logs table populated by the express
  // middleware in server/index.ts (fire-and-forget). The endpoint itself
  // is excluded from logging in that middleware so polling the dashboard
  // doesn't dominate the dataset.
  app.get("/api/admin/analytics/traffic", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const adminCheck = await isAdminUser(userId);
      if (!adminCheck) return res.status(403).json({ message: "Forbidden" });

      const rangeParam = String(req.query.range || "24h");
      // Map the friendly range param to a SQL interval and the bucket size
      // used for the time-series chart. Anything outside the allowlist
      // falls back to 24h to avoid SQL injection / unbounded scans.
      let intervalSql: any;
      let bucket: "hour" | "day";
      if (rangeParam === "7d") {
        intervalSql = sql`INTERVAL '7 days'`;
        bucket = "day";
      } else if (rangeParam === "30d") {
        intervalSql = sql`INTERVAL '30 days'`;
        bucket = "day";
      } else {
        intervalSql = sql`INTERVAL '24 hours'`;
        bucket = "hour";
      }
      const bucketSql = bucket === "hour" ? sql`'hour'` : sql`'day'`;

      // Run all six aggregates in parallel — they each scan request_logs
      // independently and PG can pipeline them.
      const [
        timeSeriesRes,
        topUrlsRes,
        topReferrersRes,
        statusesRes,
        durationsRes,
        overviewRes,
      ] = await Promise.all([
        pgDb.execute(sql`
          SELECT date_trunc(${bucketSql}, ts) AS bucket, COUNT(*)::int AS count
          FROM request_logs
          WHERE ts >= NOW() - ${intervalSql}
          GROUP BY bucket
          ORDER BY bucket ASC
        `),
        pgDb.execute(sql`
          SELECT path, COUNT(*)::int AS count
          FROM request_logs
          WHERE ts >= NOW() - ${intervalSql}
          GROUP BY path
          ORDER BY count DESC
          LIMIT 15
        `),
        pgDb.execute(sql`
          SELECT COALESCE(referer_host, '(direct)') AS host, COUNT(*)::int AS count
          FROM request_logs
          WHERE ts >= NOW() - ${intervalSql}
          GROUP BY host
          ORDER BY count DESC
          LIMIT 15
        `),
        pgDb.execute(sql`
          SELECT
            CASE
              WHEN status BETWEEN 200 AND 299 THEN '2xx'
              WHEN status BETWEEN 300 AND 399 THEN '3xx'
              WHEN status BETWEEN 400 AND 499 THEN '4xx'
              WHEN status BETWEEN 500 AND 599 THEN '5xx'
              ELSE 'other'
            END AS bucket,
            COUNT(*)::int AS count
          FROM request_logs
          WHERE ts >= NOW() - ${intervalSql}
          GROUP BY bucket
          ORDER BY bucket
        `),
        pgDb.execute(sql`
          SELECT
            CASE
              WHEN duration_ms < 100 THEN '<100ms'
              WHEN duration_ms < 500 THEN '100-500ms'
              WHEN duration_ms < 1000 THEN '500ms-1s'
              WHEN duration_ms < 2000 THEN '1-2s'
              WHEN duration_ms < 5000 THEN '2-5s'
              ELSE '5s+'
            END AS bucket,
            COUNT(*)::int AS count
          FROM request_logs
          WHERE ts >= NOW() - ${intervalSql}
          GROUP BY bucket
        `),
        pgDb.execute(sql`
          SELECT
            COUNT(*)::int AS total,
            COUNT(DISTINCT ip)::int AS unique_ips,
            COALESCE(AVG(duration_ms), 0)::int AS avg_duration,
            COALESCE(SUM(CASE WHEN status >= 500 THEN 1 ELSE 0 END), 0)::int AS errors
          FROM request_logs
          WHERE ts >= NOW() - ${intervalSql}
        `),
      ]);

      // node-postgres returns either { rows } or an array depending on the
      // adapter. Normalize so the rest of this handler can use a plain array.
      const rows = (r: any): any[] => (Array.isArray(r) ? r : r?.rows ?? []);

      // Order the histogram buckets so the chart x-axis is monotonic
      // regardless of which buckets came back from the DB.
      const durationOrder = ["<100ms", "100-500ms", "500ms-1s", "1-2s", "2-5s", "5s+"];
      const statusOrder = ["2xx", "3xx", "4xx", "5xx", "other"];
      const sortBy = (rs: any[], order: string[], key = "bucket") =>
        order
          .map((b) => rs.find((r) => r[key] === b))
          .filter(Boolean)
          .map((r) => ({ bucket: r[key], count: Number(r.count) || 0 }));

      const overview = rows(overviewRes)[0] ?? {};

      res.json({
        range: rangeParam,
        bucket,
        overview: {
          total: Number(overview.total) || 0,
          uniqueIps: Number(overview.unique_ips) || 0,
          avgDuration: Number(overview.avg_duration) || 0,
          errors: Number(overview.errors) || 0,
        },
        timeSeries: rows(timeSeriesRes).map((r: any) => ({
          bucket: r.bucket,
          count: Number(r.count) || 0,
        })),
        topUrls: rows(topUrlsRes).map((r: any) => ({
          path: r.path,
          count: Number(r.count) || 0,
        })),
        topReferrers: rows(topReferrersRes).map((r: any) => ({
          host: r.host,
          count: Number(r.count) || 0,
        })),
        statuses: sortBy(rows(statusesRes), statusOrder),
        durations: sortBy(rows(durationsRes), durationOrder),
      });
    } catch (err) {
      console.error("Admin traffic analytics error:", err);
      res.status(500).json({ message: "Failed to fetch traffic analytics" });
    }
  });

  // ============ JOB LISTING ROUTES ============

  app.get("/api/jobs/pricing", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user?.linkedBusinessId) {
        return res.json({ tier: "none", tierLabel: "No Membership", pricePerWeek: 0, eligible: false });
      }
      const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, user.linkedBusinessId));
      const tierKey = biz ? getEffectiveTier(biz) : "none";
      const JOB_PRICES: Record<string, number> = { premium: 1000, standard: 1500, basic: 1800 };
      const tierLabel = tierKey === "premium" ? "Gold" : tierKey === "standard" ? "Silver" : tierKey === "basic" ? "Bronze" : "No Membership";
      const eligible = tierKey !== "none" && JOB_PRICES[tierKey] !== undefined;
      res.json({ tier: tierKey, tierLabel, pricePerWeek: JOB_PRICES[tierKey] ?? 0, eligible });
    } catch (err) {
      console.error("Error fetching job pricing:", err);
      res.status(500).json({ message: "Failed to fetch pricing" });
    }
  });

  app.get("/api/jobs", async (_req, res) => {
    try {
      const listings = await storage.getActiveJobListings();
      res.json(listings);
    } catch (err) {
      console.error("Error fetching job listings:", err);
      res.status(500).json({ message: "Failed to fetch job listings" });
    }
  });

  app.get("/api/jobs/my-listings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user?.linkedBusinessId) {
        return res.json([]);
      }
      const listings = await storage.getJobListingsByBusiness(user.linkedBusinessId);
      res.json(listings);
    } catch (err) {
      console.error("Error fetching user job listings:", err);
      res.status(500).json({ message: "Failed to fetch your listings" });
    }
  });

  app.post("/api/jobs", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user?.linkedBusinessId) {
        return res.status(403).json({ message: "Only business accounts can post job listings" });
      }

      const parsed = insertJobListingSchema.parse({
        ...req.body,
        businessId: user.linkedBusinessId,
      });
      const listing = await storage.createJobListing(parsed);
      res.status(201).json(listing);
    } catch (err: any) {
      console.error("Error creating job listing:", err);
      res.status(400).json({ message: err.message || "Failed to create job listing" });
    }
  });

  app.patch("/api/jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const listingId = parseInt(req.params.id);
      const listing = await storage.getJobListing(listingId);
      if (!listing) {
        return res.status(404).json({ message: "Job listing not found" });
      }

      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user?.linkedBusinessId || user.linkedBusinessId !== listing.businessId) {
        return res.status(403).json({ message: "You can only edit your own listings" });
      }

      const allowedFields = ["title", "description", "imageUrl", "contactPhone", "contactEmail"];
      const sanitized: Record<string, any> = {};
      for (const key of allowedFields) {
        if (req.body[key] !== undefined) {
          sanitized[key] = req.body[key];
        }
      }
      const updated = await storage.updateJobListing(listingId, sanitized);
      res.json(updated);
    } catch (err) {
      console.error("Error updating job listing:", err);
      res.status(500).json({ message: "Failed to update job listing" });
    }
  });

  app.delete("/api/jobs/:id", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.id;
      const listingId = parseInt(req.params.id);
      const listing = await storage.getJobListing(listingId);
      if (!listing) {
        return res.status(404).json({ message: "Job listing not found" });
      }

      const [user] = await pgDb.select().from(users).where(eq(users.id, userId));
      if (!user?.linkedBusinessId || user.linkedBusinessId !== listing.businessId) {
        return res.status(403).json({ message: "You can only delete your own listings" });
      }

      if (listing.stripeSubscriptionId) {
        try {
          const stripe = (await import("stripe")).default;
          const stripeClient = new stripe(process.env.Stripeintegration || "");
          await stripeClient.subscriptions.cancel(listing.stripeSubscriptionId);
          console.log(`Cancelled Stripe subscription ${listing.stripeSubscriptionId} for job listing ${listingId}`);
        } catch (stripeErr: any) {
          console.error(`Failed to cancel Stripe subscription for job ${listingId}:`, stripeErr.message);
        }
      }

      await storage.deleteJobListing(listingId);
      res.status(204).send();
    } catch (err) {
      console.error("Error deleting job listing:", err);
      res.status(500).json({ message: "Failed to delete job listing" });
    }
  });

  app.post("/api/analytics/track", async (req, res) => {
    try {
      const { businessId, eventType } = req.body;
      if (!businessId || !eventType) {
        return res.status(400).json({ message: "businessId and eventType are required" });
      }
      const validTypes = ["page_view", "phone_click", "email_click", "website_click", "directions_click"];
      if (!validTypes.includes(eventType)) {
        return res.status(400).json({ message: "Invalid event type" });
      }
      await pgDb.insert(businessAnalytics).values({
        businessId: parseInt(businessId),
        eventType,
      });
      res.json({ success: true });
    } catch (err) {
      console.error("Error tracking analytics:", err);
      res.status(500).json({ message: "Failed to track event" });
    }
  });

  app.get("/api/analytics/:businessId", isAuthenticated, async (req: any, res) => {
    try {
      const businessId = parseInt(req.params.businessId);
      if (!businessId) {
        return res.status(400).json({ message: "Invalid business ID" });
      }

      const isAdmin = req.user?.accountType === "admin";
      const [currentUser] = await pgDb.select({ linkedBusinessId: users.linkedBusinessId }).from(users).where(eq(users.id, req.user?.id)).limit(1);
      const isOwner = currentUser && currentUser.linkedBusinessId === businessId;
      if (!isAdmin && !isOwner) {
        return res.status(403).json({ message: "You can only view analytics for your own business" });
      }

      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const results = await pgDb.select({
        eventType: businessAnalytics.eventType,
        eventDate: businessAnalytics.eventDate,
      }).from(businessAnalytics).where(
        and(
          eq(businessAnalytics.businessId, businessId),
          gt(businessAnalytics.eventDate, thirtyDaysAgo)
        )
      ).orderBy(asc(businessAnalytics.eventDate));

      const totals: Record<string, number> = {};
      const daily: Record<string, Record<string, number>> = {};

      for (const row of results) {
        const type = row.eventType;
        totals[type] = (totals[type] || 0) + 1;

        const dateKey = row.eventDate ? new Date(row.eventDate).toISOString().split("T")[0] : "unknown";
        if (!daily[dateKey]) daily[dateKey] = {};
        daily[dateKey][type] = (daily[dateKey][type] || 0) + 1;
      }

      const allTimeTotals = await pgDb.select({
        eventType: businessAnalytics.eventType,
        count: sql<number>`count(*)::int`,
      }).from(businessAnalytics).where(eq(businessAnalytics.businessId, businessId)).groupBy(businessAnalytics.eventType);

      const allTime: Record<string, number> = {};
      for (const row of allTimeTotals) {
        allTime[row.eventType] = row.count;
      }

      res.json({ totals, daily, allTime });
    } catch (err) {
      console.error("Error fetching analytics:", err);
      res.status(500).json({ message: "Failed to fetch analytics" });
    }
  });

  // Seed ad pricing if not exists
  await seedAdPricing();

  // Seed Data
  await seedDatabase();

  setInterval(async () => {
    try {
      await checkExpiredGoldTrials();
    } catch (e) {
      console.error("Gold trial check error:", e);
    }
    try {
      await sendCompExpiryReminders();
    } catch (e) {
      console.error("Comp expiry reminder error:", e);
    }
    try {
      await checkExpiredCompMemberships();
    } catch (e) {
      console.error("Comp membership expiry check error:", e);
    }
    try {
      await checkBounceRateAlerts();
    } catch (e) {
      console.error("Bounce-rate alert check error:", e);
    }
    try {
      await checkBounceSpikeAlerts();
    } catch (e) {
      console.error("Bounce-spike owner alert check error:", e);
    }
  }, 60 * 60 * 1000);

  setTimeout(() => checkExpiredGoldTrials().catch(e => console.error("Initial gold trial check error:", e)), 10000);
  setTimeout(() => sendCompExpiryReminders().catch(e => console.error("Initial comp expiry reminder error:", e)), 12000);
  setTimeout(() => checkExpiredCompMemberships().catch(e => console.error("Initial comp expiry check error:", e)), 13000);
  setTimeout(() => checkBounceRateAlerts().catch(e => console.error("Initial bounce-rate alert check error:", e)), 14000);
  setTimeout(() => checkBounceSpikeAlerts().catch(e => console.error("Initial bounce-spike owner alert check error:", e)), 15000);

  setTimeout(() => seedAdminAccounts().catch(e => console.error("Admin seed error:", e)), 5000);

  return httpServer;
}

// Periodic sweep that emails comp recipients before their free Gold expires.
// Hourly cadence is fine — each business has two boolean flags
// (`compedMembershipReminder7Sent`/`...Reminder1Sent`) that gate sending
// so the same warning never fires twice for the same expiry window.
// Flags reset on grant/revoke so a re-grant or expiry change earns a fresh
// round of reminders.
export type CompExpiringNotifier = typeof notifyCompExpiring;

export async function sendCompExpiryReminders(
  notifier: CompExpiringNotifier = notifyCompExpiring,
) {
  const now = new Date();
  const in7d = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
  const in1d = new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000);

  // Pull every active comp grant with a future expiry — small set, single
  // query is cheaper than two windowed queries with extra filters.
  const candidates = await pgDb
    .select({
      id: businesses.id,
      name: businesses.name,
      email: businesses.email,
      ownerUserId: businesses.ownerUserId,
      expiresAt: businesses.compedMembershipExpiresAt,
      reminder7Sent: businesses.compedMembershipReminder7Sent,
      reminder1Sent: businesses.compedMembershipReminder1Sent,
    })
    .from(businesses)
    .where(
      and(
        eq(businesses.isCompedMembership, true),
        sql`${businesses.compedMembershipExpiresAt} IS NOT NULL`,
        sql`${businesses.compedMembershipExpiresAt} > ${now}`,
      ),
    );

  for (const biz of candidates) {
    if (!biz.expiresAt) continue;
    const exp = new Date(biz.expiresAt).getTime();

    // Resolve recipient lazily — only look up user.email when business.email
    // is missing AND we actually need to send something this pass.
    const needs1d = !biz.reminder1Sent && exp <= in1d.getTime();
    const needs7d = !needs1d && !biz.reminder7Sent && exp <= in7d.getTime();
    if (!needs1d && !needs7d) continue;

    let recipientEmail: string | null = biz.email ?? null;
    if (!recipientEmail && biz.ownerUserId) {
      const [owner] = await pgDb
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, biz.ownerUserId));
      recipientEmail = owner?.email ?? null;
    }

    if (needs1d) {
      // 1-day window also implies the 7-day window has passed; flip both
      // flags so a business that was granted with <7d remaining doesn't
      // get a stale "ends in 7 days" email next hour.
      // Only persist the "sent" flags when delivery actually succeeds so a
      // transient Resend outage (or a missing recipient that gets fixed
      // later) doesn't permanently suppress the warning.
      let sent = false;
      try {
        sent = await notifier({
          recipientEmail,
          businessName: biz.name,
          expiresAt: biz.expiresAt,
          daysRemaining: 1,
        });
      } catch (e) {
        console.error("notifyCompExpiring(1d) error:", e);
      }
      if (sent) {
        await pgDb
          .update(businesses)
          .set({ compedMembershipReminder1Sent: true, compedMembershipReminder7Sent: true })
          .where(eq(businesses.id, biz.id));
      }
    } else if (needs7d) {
      let sent = false;
      try {
        sent = await notifier({
          recipientEmail,
          businessName: biz.name,
          expiresAt: biz.expiresAt,
          daysRemaining: 7,
        });
      } catch (e) {
        console.error("notifyCompExpiring(7d) error:", e);
      }
      if (sent) {
        await pgDb
          .update(businesses)
          .set({ compedMembershipReminder7Sent: true })
          .where(eq(businesses.id, biz.id));
      }
    }
  }
}

/**
 * Auto-revert any comp recipient whose `compedMembershipExpiresAt` has passed.
 * Without this, the flag lingers forever and `getEffectiveTier()` keeps
 * returning "premium" for businesses whose grant should already be over —
 * worse, the admin Comp Memberships report keeps counting them as active.
 *
 * For each expired row we:
 *   1. Clear `isCompedMembership` and the related grant/note/expiry/grantedBy
 *      columns (mirrors what the manual /api/admin/businesses/:id/comp revoke
 *      flow does, so feature gates immediately fall back to `membershipTier`).
 *      Reminder-sent flags are also cleared so a future re-grant gets a
 *      fresh round of 7d/1d reminders from `sendCompExpiryReminders`.
 *   2. Append a `comp_membership_audit` row with action='expire' so the
 *      historical "who/when" survives the column wipe.
 *   3. Best-effort email the owner that their free Gold has ended (failures
 *      are logged but never block the state change).
 *
 * Idempotent — re-running the job after the columns have been cleared finds
 * nothing to do because the WHERE clause requires `isCompedMembership=true`.
 */
export async function checkExpiredCompMemberships() {
  const now = new Date();
  const expired = await pgDb
    .select({
      id: businesses.id,
      name: businesses.name,
      email: businesses.email,
      membershipTier: businesses.membershipTier,
      compedMembershipExpiresAt: businesses.compedMembershipExpiresAt,
    })
    .from(businesses)
    .where(
      and(
        eq(businesses.isCompedMembership, true),
        isNotNull(businesses.compedMembershipExpiresAt),
        lte(businesses.compedMembershipExpiresAt, now),
      ),
    );

  for (const biz of expired) {
    try {
      await pgDb
        .update(businesses)
        .set({
          isCompedMembership: false,
          compedMembershipNote: null,
          compedMembershipGrantedAt: null,
          compedMembershipGrantedBy: null,
          compedMembershipExpiresAt: null,
          compedMembershipReminder7Sent: false,
          compedMembershipReminder1Sent: false,
        })
        .where(eq(businesses.id, biz.id));

      await pgDb.insert(compMembershipAudit).values({
        businessId: biz.id,
        action: "expire",
        actorUserId: null,
        note: "Auto-reverted by scheduled job after compedMembershipExpiresAt passed",
        expiresAt: biz.compedMembershipExpiresAt ?? null,
      });

      // When `membershipTier` is null the business has no paid plan to fall
      // back to, so the email should say "Free" rather than implying Bronze
      // (which is what "basic" maps to in `notifyOwnerCompExpired`).
      const revertedTo = biz.membershipTier ?? "none";
      console.log(
        `Comp expiry: business ${biz.id} (${biz.name}) auto-reverted to ${revertedTo}`,
      );

      notifyOwnerCompExpired({
        ownerEmail: biz.email,
        businessName: biz.name,
        revertedToTier: revertedTo,
      }).catch((e) =>
        console.error(`Comp expiry notify failed for business ${biz.id}:`, e),
      );
    } catch (e) {
      console.error(`Comp expiry processing failed for business ${biz.id}:`, e);
    }
  }

  if (expired.length > 0) {
    console.log(`Comp expiry check complete: ${expired.length} business(es) reverted`);
  }
}

async function checkExpiredGoldTrials() {
  const now = new Date();
  const expired = await pgDb.select({
    id: businesses.id,
    name: businesses.name,
    membershipTier: businesses.membershipTier,
    originalMembershipTier: businesses.originalMembershipTier,
    goldTrialEndDate: businesses.goldTrialEndDate,
  }).from(businesses).where(
    and(
      sql`${businesses.goldTrialEndDate} IS NOT NULL`,
      sql`${businesses.originalMembershipTier} IS NOT NULL`,
      lte(businesses.goldTrialEndDate, now),
      eq(businesses.membershipTier, "premium")
    )
  );

  for (const biz of expired) {
    const revertTier = biz.originalMembershipTier || "basic";
    await pgDb.update(businesses).set({
      membershipTier: revertTier,
      goldTrialEndDate: null,
      originalMembershipTier: null,
    }).where(eq(businesses.id, biz.id));
    console.log(`Gold trial safety net: business ${biz.id} (${biz.name}) reverted from premium to ${revertTier}`);
  }

  if (expired.length > 0) {
    console.log(`Gold trial check complete: ${expired.length} business(es) reverted`);
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Bounce-rate spike alerting
   --------------------------
   The Resend webhook now back-fills `review_requests.status='failed'` with
   `errorMsg` starting with `email[permanent]:` for any address that bounces
   asynchronously. Without a watchdog we'd only notice a reputation problem
   when Resend throttles us. This job samples the last N email sends per
   business in the last 24h, computes the bounce rate, and emails admins
   when it exceeds the configured threshold.

   Knobs (env-overridable so we can tighten or loosen without a deploy):
     BOUNCE_RATE_THRESHOLD_PCT   default 10     (alert when % > this)
     BOUNCE_RATE_SAMPLE_SIZE     default 100    (most recent sends per biz)
     BOUNCE_RATE_LOOKBACK_HOURS  default 24
     BOUNCE_RATE_MIN_VOLUME      default 10     (skip tiny samples — 1/3 = 33%
                                                 is noise, not a real spike)
     BOUNCE_RATE_COOLDOWN_HOURS  default 24     (re-alert cooldown per biz)

   Idempotency: each successful alert writes a row to `bounce_rate_alerts`.
   A business is skipped if its most recent alert is newer than the cooldown
   window, so the hourly cron never spams admins about the same offender.
   ────────────────────────────────────────────────────────────────────────── */
export type BounceRateSpikeNotifier = typeof notifyAdminBounceRateSpike;

function readIntEnv(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function checkBounceRateAlerts(
  notifier: BounceRateSpikeNotifier = notifyAdminBounceRateSpike,
) {
  const thresholdPct = readIntEnv("BOUNCE_RATE_THRESHOLD_PCT", 10);
  const sampleSize = readIntEnv("BOUNCE_RATE_SAMPLE_SIZE", 100);
  const lookbackHours = readIntEnv("BOUNCE_RATE_LOOKBACK_HOURS", 24);
  const minVolume = readIntEnv("BOUNCE_RATE_MIN_VOLUME", 10);
  const cooldownHours = readIntEnv("BOUNCE_RATE_COOLDOWN_HOURS", 24);

  const now = new Date();
  const windowStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);
  const cooldownStart = new Date(now.getTime() - cooldownHours * 60 * 60 * 1000);

  // Per-business: of the most recent `sampleSize` *attempted* email sends in
  // the last `lookbackHours`, how many came back as a permanent bounce?
  // Denominator definition matters here — we deliberately exclude rows still
  // in 'queued' (no send actually happened yet) so a backlog of pending rows
  // can't dilute the bounce rate and suppress an alert. Only rows that
  // represent a real send outcome count: 'sent', 'clicked' and 'completed'
  // are successful deliveries; 'failed' is either a hard bounce
  // (`email[permanent]:`) — which is the numerator — or a soft/transient
  // failure that still represents a real Resend round-trip and so still
  // belongs in the denominator. Permanent bounces are exactly the rows the
  // Resend webhook + the synchronous permanent-failure path mark with
  // `email[permanent]:`; soft bounces and generic failures are excluded
  // from the numerator on purpose.
  const rows = await pgDb.execute<{
    business_id: number;
    total: string;
    bounces: string;
  }>(sql`
    SELECT business_id,
           SUM(CASE WHEN rn <= ${sampleSize} THEN 1 ELSE 0 END)::text AS total,
           SUM(CASE WHEN rn <= ${sampleSize}
                     AND status = 'failed'
                     AND error_msg LIKE 'email[permanent]:%'
                    THEN 1 ELSE 0 END)::text AS bounces
    FROM (
      SELECT business_id, status, error_msg,
             ROW_NUMBER() OVER (
               PARTITION BY business_id
               ORDER BY COALESCE(sent_at, created_at) DESC
             ) AS rn
      FROM review_requests
      WHERE channel IN ('email', 'both')
        AND status IN ('sent', 'failed', 'clicked', 'completed')
        AND COALESCE(sent_at, created_at) >= ${windowStart}
    ) sub
    GROUP BY business_id
  `);

  const candidates: Array<{
    businessId: number;
    total: number;
    bounces: number;
    rateBp: number;
  }> = [];
  for (const r of (rows.rows ?? []) as Array<{ business_id: number; total: string; bounces: string }>) {
    const total = Number(r.total);
    const bounces = Number(r.bounces);
    if (!Number.isFinite(total) || total < minVolume) continue;
    const rateBp = Math.round((bounces / total) * 10_000);
    if (rateBp <= thresholdPct * 100) continue;
    candidates.push({ businessId: r.business_id, total, bounces, rateBp });
  }

  if (candidates.length === 0) return;

  for (const c of candidates) {
    // Cooldown: skip if we already alerted on this business inside the
    // cooldown window. Reading per-business is cheap (small candidate set,
    // indexed on business_id by the FK).
    const recent = await pgDb
      .select({ id: bounceRateAlerts.id })
      .from(bounceRateAlerts)
      .where(
        and(
          eq(bounceRateAlerts.businessId, c.businessId),
          gte(bounceRateAlerts.alertedAt, cooldownStart),
        ),
      )
      .limit(1);
    if (recent.length > 0) continue;

    const [biz] = await pgDb
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, c.businessId));
    if (!biz) continue;

    let sent = false;
    try {
      sent = await notifier({
        businessId: biz.id,
        businessName: biz.name,
        bounceCount: c.bounces,
        totalCount: c.total,
        bounceRatePct: c.rateBp / 100,
        thresholdPct,
        windowHours: lookbackHours,
        sampleSize,
      });
    } catch (e) {
      console.error(`Bounce-rate alert notify failed for business ${biz.id}:`, e);
      continue;
    }

    if (sent) {
      await pgDb.insert(bounceRateAlerts).values({
        businessId: biz.id,
        bounceCount: c.bounces,
        totalCount: c.total,
        bounceRateBp: c.rateBp,
      });
      console.log(
        `[bounce-rate-alert] business ${biz.id} (${biz.name}) — ${c.bounces}/${c.total} = ${(c.rateBp / 100).toFixed(2)}%`,
      );
    }
  }
}

/* ──────────────────────────────────────────────────────────────────────────
   Owner-facing bounce-spike heads-up
   ----------------------------------
   The in-app Review Requests panel only helps owners who happen to visit it.
   When an imported list lands a sudden cluster of webhook-confirmed permanent
   bounces (`recipient_suppressions.reason LIKE 'webhook:%'`), this job emails
   the owner directly with a link to clean things up.

   This is intentionally separate from `checkBounceRateAlerts`:
     - `bounce_rate_alerts`  → admin-only, %-based, sender-reputation guard
     - `bounce_spike_alerts` → owner-only, raw-count based, list-hygiene nudge
   so changing one doesn't quietly retune the other.

   Knobs (env-overridable so we can tighten without a deploy):
     BOUNCE_SPIKE_THRESHOLD        default 5    (alert when count >= this)
     BOUNCE_SPIKE_LOOKBACK_HOURS   default 24
     BOUNCE_SPIKE_COOLDOWN_HOURS   default 24   (re-alert cooldown per biz)

   Idempotency: each successful send writes a row to `bounce_spike_alerts`.
   A business is skipped if its newest row there is younger than the cooldown
   window, so the hourly cron never spams the same owner about the same spike.
   ────────────────────────────────────────────────────────────────────────── */
export type BounceSpikeOwnerNotifier = typeof notifyOwnerBounceSpike;

export async function checkBounceSpikeAlerts(
  notifier: BounceSpikeOwnerNotifier = notifyOwnerBounceSpike,
) {
  const defaultThreshold = readIntEnv("BOUNCE_SPIKE_THRESHOLD", 5);
  const lookbackHours = readIntEnv("BOUNCE_SPIKE_LOOKBACK_HOURS", 24);
  const defaultCooldownHours = readIntEnv("BOUNCE_SPIKE_COOLDOWN_HOURS", 24);

  const now = new Date();
  const windowStart = new Date(now.getTime() - lookbackHours * 60 * 60 * 1000);

  // Per-business: how many webhook-confirmed permanent bounces landed in the
  // lookback window? Only `webhook:%` rows count — we don't want owner-driven
  // manual suppressions or admin sweeps to trigger a panic email.
  const grouped = await pgDb
    .select({
      businessId: recipientSuppressions.businessId,
      bounceCount: sql<number>`count(*)::int`,
    })
    .from(recipientSuppressions)
    .where(
      and(
        // Belt-and-suspenders: today only the email Resend webhook ever
        // writes `webhook:%` rows, but pinning contactType makes sure a
        // future SMS/voice webhook with the same `webhook:` prefix can't
        // accidentally trip the email-only owner alert.
        eq(recipientSuppressions.contactType, "email"),
        sql`${recipientSuppressions.reason} LIKE 'webhook:%'`,
        gte(recipientSuppressions.createdAt, windowStart),
      ),
    )
    .groupBy(recipientSuppressions.businessId);

  // We can't pre-filter by the global threshold anymore — a small business
  // may have lowered its `bounceSpikeThreshold` to 1, while a Gold high-
  // volume business may have raised it to 25. Decide per row below using
  // each business's own override (falling back to the env default).
  if (grouped.length === 0) return;

  for (const c of grouped) {
    const [biz] = await pgDb
      .select({
        id: businesses.id,
        name: businesses.name,
        email: businesses.email,
        ownerUserId: businesses.ownerUserId,
        bounceSpikeThreshold: businesses.bounceSpikeThreshold,
        bounceSpikeCadenceHours: businesses.bounceSpikeCadenceHours,
        bounceSpikeMuted: businesses.bounceSpikeMuted,
      })
      .from(businesses)
      .where(eq(businesses.id, c.businessId));
    if (!biz) continue;

    // Owner explicitly muted email heads-ups — they still get the in-app
    // Recently-auto-suppressed panel on the Review Requests page, so they
    // can self-serve when they next log in. Skip without writing a
    // cooldown row so unmuting later resumes alerts immediately.
    if (biz.bounceSpikeMuted === true) continue;

    const effectiveThreshold = biz.bounceSpikeThreshold ?? defaultThreshold;
    if (c.bounceCount < effectiveThreshold) continue;

    const effectiveCooldownHours = biz.bounceSpikeCadenceHours ?? defaultCooldownHours;
    const cooldownStart = new Date(now.getTime() - effectiveCooldownHours * 60 * 60 * 1000);

    // Cooldown — skip if we already pinged this owner inside the window.
    const recent = await pgDb
      .select({ id: bounceSpikeAlerts.id })
      .from(bounceSpikeAlerts)
      .where(
        and(
          eq(bounceSpikeAlerts.businessId, c.businessId),
          gte(bounceSpikeAlerts.alertedAt, cooldownStart),
        ),
      )
      .limit(1);
    if (recent.length > 0) continue;

    // Resolve owner email — prefer the listing's contact email, fall back to
    // the linked user's account email so legacy rows without `email` still
    // get the heads-up.
    let recipientEmail: string | null = biz.email ?? null;
    if (!recipientEmail && biz.ownerUserId) {
      const [owner] = await pgDb
        .select({ email: users.email })
        .from(users)
        .where(eq(users.id, biz.ownerUserId));
      recipientEmail = owner?.email ?? null;
    }

    let sent = false;
    try {
      sent = await notifier({
        recipientEmail,
        businessName: biz.name,
        bounceCount: c.bounceCount,
        windowHours: lookbackHours,
      });
    } catch (e) {
      console.error(`Bounce-spike owner notify failed for business ${biz.id}:`, e);
      continue;
    }

    if (sent) {
      await pgDb.insert(bounceSpikeAlerts).values({
        businessId: biz.id,
        bounceCount: c.bounceCount,
      });
      console.log(
        `[bounce-spike-alert] business ${biz.id} (${biz.name}) — ${c.bounceCount} bounces in last ${lookbackHours}h`,
      );
    }
  }
}

// Daily heads-up emails for comp recipients whose Gold access ends in
// exactly 7 or 1 days. Idempotent via comp_expiration_reminders unique
// index on (businessId, thresholdDays, sentForExpiresAt) — if an admin
// later extends the comp, the new expiry is a new sentForExpiresAt so
// the reminders fire again for the fresh window.
const COMP_REMINDER_THRESHOLDS = [7, 1] as const;

async function sendCompExpirationReminders() {
  const now = new Date();
  const dayMs = 24 * 60 * 60 * 1000;

  for (const threshold of COMP_REMINDER_THRESHOLDS) {
    // We want comps whose expiry is "exactly N days away" — match the
    // 24-hour window (now + (N-1)d, now + N*d]. Hourly cron + idempotent
    // insert means we'll send once per (business, threshold) per expiry.
    const windowStart = new Date(now.getTime() + (threshold - 1) * dayMs);
    const windowEnd = new Date(now.getTime() + threshold * dayMs);

    const due = await pgDb
      .select({
        id: businesses.id,
        name: businesses.name,
        email: businesses.email,
        ownerUserId: businesses.ownerUserId,
        compedMembershipExpiresAt: businesses.compedMembershipExpiresAt,
      })
      .from(businesses)
      .where(
        and(
          eq(businesses.isCompedMembership, true),
          isNotNull(businesses.compedMembershipExpiresAt),
          gt(businesses.compedMembershipExpiresAt, windowStart),
          lte(businesses.compedMembershipExpiresAt, windowEnd),
        ),
      );

    for (const biz of due) {
      const expiresAt = biz.compedMembershipExpiresAt as Date;

      // Resolve owner email — prefer the linked user account (matches the
      // account that sees the in-app banner), fall back to businesses.email.
      let toEmail: string | null = null;
      if (biz.ownerUserId) {
        const [u] = await pgDb
          .select({ email: users.email })
          .from(users)
          .where(eq(users.id, biz.ownerUserId))
          .limit(1);
        if (u?.email) toEmail = u.email;
      }
      if (!toEmail) {
        const [u] = await pgDb
          .select({ email: users.email })
          .from(users)
          .where(eq(users.linkedBusinessId, biz.id))
          .limit(1);
        if (u?.email) toEmail = u.email;
      }
      if (!toEmail && biz.email) toEmail = biz.email;
      if (!toEmail) {
        console.warn(
          `[COMP REMINDER] Skipping business ${biz.id} (${biz.name}) — no owner email`,
        );
        continue;
      }

      // Reserve the (business, threshold, expiresAt) slot first so a crash
      // mid-send can't double-fire on the next tick. ON CONFLICT DO NOTHING
      // means a parallel sender (or a previous successful run) wins and we
      // skip the email. We use returning() to know whether we got the slot.
      const inserted = await pgDb
        .insert(compExpirationReminders)
        .values({
          businessId: biz.id,
          thresholdDays: threshold,
          sentForExpiresAt: expiresAt,
        })
        .onConflictDoNothing({
          target: [
            compExpirationReminders.businessId,
            compExpirationReminders.thresholdDays,
            compExpirationReminders.sentForExpiresAt,
          ],
        })
        .returning({ id: compExpirationReminders.id });

      if (inserted.length === 0) continue; // already sent for this expiry

      const daysLeft = Math.max(
        1,
        Math.ceil((expiresAt.getTime() - now.getTime()) / dayMs),
      );

      await sendCompExpirationReminder({
        toEmail,
        businessName: biz.name,
        daysLeft: threshold, // use canonical threshold for stable copy
        endDate: expiresAt,
      });
      void daysLeft; // intentionally unused; kept for future tuning
    }

    if (due.length > 0) {
      console.log(
        `Comp expiration reminders (${threshold}d): processed ${due.length} candidate business(es)`,
      );
    }
  }
}

async function seedAdPricing() {
  try {
    const existingPricing = await pgDb.select().from(adPricing);
    
    const desiredPricing = [
      { placementType: "large_banner", displayName: "Large Carousel Banner", description: "Full-width premium banner in the ad carousel on Home and Directory pages. Maximum visibility and impact.", pricePerWeek: 25000, maxActive: 5 },
      { placementType: "medium_banner", displayName: "Medium Carousel Banner", description: "50%-width banner in the ad carousel on Home and Directory pages. Great visibility at a mid-range price.", pricePerWeek: 12500, maxActive: 5 },
      { placementType: "small_banner", displayName: "Small Carousel Banner", description: "Compact banner in the ad carousel on Home and Directory pages. Affordable visibility for your business.", pricePerWeek: 6250, maxActive: 5 },
    ];

    const desiredTypes = desiredPricing.map(d => d.placementType);
    const existingTypes = existingPricing.map(p => p.placementType);
    const toAdd = desiredPricing.filter(d => !existingTypes.includes(d.placementType));
    if (toAdd.length > 0) {
      await pgDb.insert(adPricing).values(toAdd);
      console.log(`Seeded ${toAdd.length} ad pricing tiers`);
    }
    for (const desired of desiredPricing) {
      const existing = existingPricing.find(e => e.placementType === desired.placementType);
      if (existing && (existing.displayName !== desired.displayName || existing.description !== desired.description)) {
        await pgDb.update(adPricing).set({ displayName: desired.displayName, description: desired.description }).where(eq(adPricing.placementType, desired.placementType));
        console.log(`Updated ad pricing display for ${desired.placementType}`);
      }
    }
    const toRemove = existingPricing.filter(p => !desiredTypes.includes(p.placementType));
    for (const old of toRemove) {
      await pgDb.delete(adPricing).where(eq(adPricing.id, old.id));
      console.log(`Removed obsolete ad pricing: ${old.placementType}`);
    }
  } catch (err) {
    console.error("Error seeding ad pricing:", err);
  }
}

async function seedDatabase() {
  // Seed categories in Replit KV database
  console.log("Checking for existing categories...");
  const existingCategories = await db.get('categories');
  console.log("Existing categories result:", existingCategories);
  const catList = existingCategories?.ok ? existingCategories.value : (Array.isArray(existingCategories) ? existingCategories : null);
  if (catList && Array.isArray(catList)) {
    const newCats = [
      { id: 35, name: "Recreation & Sports", subs: ["Golf", "Fishing", "Fitness", "Outdoor Adventures"] },
      { id: 36, name: "Restaurants & Dining", subs: ["Dine-In", "Takeout", "Bar & Grill", "Seafood"] },
      { id: 37, name: "IT & Technology", subs: ["Computer Repair", "Networking", "Web Hosting", "Managed IT"] },
      { id: 38, name: "Land Development", subs: [] },
    ];
    const existingNames = catList.map((c: any) => c.name);
    const toAdd = newCats.filter(c => !existingNames.includes(c.name));
    if (toAdd.length > 0) {
      const updated = [...catList, ...toAdd];
      await db.set('categories', updated);
      console.log(`Added ${toAdd.length} new categories: ${toAdd.map(c => c.name).join(', ')}`);
    }
  }
  if (!existingCategories || (existingCategories && existingCategories.ok === false)) {
    console.log("Seeding categories...");
    const categories = [
      { id: 1, name: "Home Repair", subs: [] },
      { id: 2, name: "Plumbing", subs: [] },
      { id: 3, name: "HVAC", subs: [] },
      { id: 4, name: "Electrical", subs: [] },
      { id: 5, name: "Roofing", subs: [] },
      { id: 6, name: "Landscaping", subs: [] },
      { id: 7, name: "Cleaning", subs: [] },
      { id: 8, name: "Painting", subs: [] },
      { id: 9, name: "Tree Care", subs: [] },
      { id: 10, name: "Remodeling & Addition", subs: [] },
      { id: 11, name: "New Construction", subs: [] },
      { id: 12, name: "Baby Sitting & Nanny", subs: [] },
      { id: 13, name: "Printing", subs: [] },
      { id: 14, name: "Web Design & Logo Design", subs: [] },
      { id: 15, name: "Photo & Video", subs: [] },
      { id: 16, name: "Auto Repair", subs: [] },
      { id: 17, name: "Small Engine Repair", subs: [] },
      { id: 18, name: "Trash & Junk Removal", subs: [] },
      { id: 19, name: "Tutor & Mentor Counseling", subs: [] },
      { id: 20, name: "Health & Wellness", subs: [] },
      { id: 27, name: "Concrete", subs: [] },
      { id: 28, name: "Lawn Care", subs: [] },
      { id: 29, name: "Dog Sitting", subs: [] },
      { id: 30, name: "Real Estate / Realtors", subs: [] },
      { id: 31, name: "Shopping / Retail", subs: [] },
      { id: 32, name: "Food & Drink", subs: [] },
      { id: 21, name: "Tax CPA", subs: [] },
      { id: 22, name: "Legal", subs: [] },
      { id: 23, name: "Woodworking", subs: [] },
      { id: 24, name: "Baking & Cooking", subs: [] },
      { id: 25, name: "Catering / Food Trucks", subs: [] },
      { id: 26, name: "Entertainment Services", subs: [] },
      { id: 27, name: "Entertainment Locations", subs: [] },
      { id: 28, name: "Event Planning & Rentals", subs: ["Event Planning", "Event Rentals", "Event Locations"] },
      { id: 33, name: "Auto Detailing", subs: [] },
      { id: 34, name: "Window Tinting", subs: [] },
      { id: 35, name: "Recreation & Sports", subs: ["Golf", "Fishing", "Fitness", "Outdoor Adventures"] },
      { id: 36, name: "Restaurants & Dining", subs: ["Dine-In", "Takeout", "Bar & Grill", "Seafood"] },
      { id: 37, name: "IT & Technology", subs: ["Computer Repair", "Networking", "Web Hosting", "Managed IT"] },
      { id: 38, name: "Land Development", subs: [] },
    ];
    await db.set('categories', categories);
    console.log("Categories seeded!");
  }

  const existingBusinesses = await storage.getBusinesses();
  if (existingBusinesses.length === 0) {
    console.log("Seeding businesses for all 26 categories...");
    
    // Placeholder businesses for each of the 26 categories with matching images
    const businessData = [
      { name: "Smith Home Repair", category: "Home Repair", description: "Quality home repair services for Moyock and surrounding areas.", address: "101 Caratoke Hwy, Moyock", imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop" },
      { name: "Coastal Plumbing Co", category: "Plumbing", description: "Licensed plumbers serving Moyock and nearby communities.", address: "202 Tulls Creek Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=300&fit=crop" },
      { name: "Moyock HVAC Pros", category: "HVAC", description: "Heating and cooling experts for homes and businesses.", address: "303 Princess Anne Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1631545308207-4b7e5e573a68?w=400&h=300&fit=crop" },
      { name: "Shore Electric", category: "Electrical", description: "Certified electricians for residential and commercial.", address: "404 Courthouse Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop" },
      { name: "Moyock Roofing Co", category: "Roofing", description: "Storm-resistant roofing for homes and businesses.", address: "505 Shingle Landing Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=400&h=300&fit=crop" },
      { name: "Sandy Shores Landscaping", category: "Landscaping", description: "Native plant specialists and lawn care.", address: "606 Puddin Ridge Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=400&h=300&fit=crop" },
      { name: "Crystal Clean Moyock", category: "Cleaning", description: "Residential and commercial cleaning services.", address: "707 Caratoke Hwy, Moyock", imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop" },
      { name: "Moyock Painters", category: "Painting", description: "Interior and exterior painting for homes and businesses.", address: "808 Old Hwy 168, Moyock", imageUrl: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&h=300&fit=crop" },
      { name: "Coastal Tree Care", category: "Tree Care", description: "Tree trimming and removal services.", address: "909 Gibbs Woods Ln, Moyock", imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=300&fit=crop" },
      { name: "Moyock Home Remodeling", category: "Remodeling & Addition", description: "Custom renovations and additions.", address: "110 Eagle Creek Dr, Moyock", imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=300&fit=crop" },
      { name: "Moyock Custom Builders", category: "New Construction", description: "New home construction specialists.", address: "211 Wynfield Dr, Moyock", imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop" },
      { name: "Trusted Nannies Moyock", category: "Baby Sitting & Nanny", description: "Background-checked childcare providers.", address: "312 Laurel Run Ln, Moyock", imageUrl: "https://images.unsplash.com/photo-1587616211892-f743fcca64f9?w=400&h=300&fit=crop" },
      { name: "Coastal Print Shop", category: "Printing", description: "Business cards, signs, and custom printing.", address: "413 Caratoke Hwy, Moyock", imageUrl: "https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=400&h=300&fit=crop" },
      { name: "Moyock Digital Design", category: "Web Design & Logo Design", description: "Websites and branding for local businesses.", address: "514 Commerce Dr, Moyock", imageUrl: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&h=300&fit=crop" },
      { name: "Moyock Photo & Video", category: "Photo & Video", description: "Wedding and event photography.", address: "615 Shingle Landing Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=400&h=300&fit=crop" },
      { name: "Reliable Auto Repair", category: "Auto Repair", description: "Trusted mechanics for all makes and models.", address: "716 Caratoke Hwy, Moyock", imageUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=300&fit=crop" },
      { name: "Small Engine Experts", category: "Small Engine Repair", description: "Lawn mowers, boats, and power equipment.", address: "817 Tulls Creek Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400&h=300&fit=crop" },
      { name: "Junk Be Gone Moyock", category: "Trash & Junk Removal", description: "Fast and affordable junk removal.", address: "918 Princess Anne Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop" },
      { name: "Moyock Tutoring Center", category: "Tutor & Mentor Counseling", description: "Academic support for all ages.", address: "119 Caratoke Hwy, Moyock", imageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop" },
      { name: "Serenity Wellness", category: "Health & Wellness", description: "Yoga, meditation, and holistic health.", address: "220 Wynfield Dr, Moyock", imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop" },
      { name: "Coastal Tax Services", category: "Tax CPA", description: "Tax preparation and accounting.", address: "321 Courthouse Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop" },
      { name: "Moyock Law Group", category: "Legal", description: "Real estate and business law.", address: "422 Caratoke Hwy, Moyock", imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=300&fit=crop" },
      { name: "Moyock Woodworks", category: "Woodworking", description: "Custom furniture and woodworking.", address: "523 Old Hwy 168, Moyock", imageUrl: "https://images.unsplash.com/photo-1611095780322-bbc1f7b9f4ce?w=400&h=300&fit=crop" },
      { name: "Sweet Coastal Bakery", category: "Baking & Cooking", description: "Fresh baked goods and custom cakes.", address: "624 Caratoke Hwy, Moyock", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop" },
      { name: "Moyock Food Truck Co", category: "Catering / Food Trucks", description: "Mobile catering and food truck services.", address: "725 Tulls Creek Rd, Moyock", imageUrl: "https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=400&h=300&fit=crop" },
      { name: "Coastal Events & Rentals", category: "Event Planning & Rentals", description: "Weddings, parties, and tent rentals.", address: "826 Caratoke Hwy, Moyock", imageUrl: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop" },
    ];

    for (const biz of businessData) {
      await storage.createBusiness({
        name: biz.name,
        description: biz.description,
        address: biz.address,
        category: biz.category,
        imageUrl: biz.imageUrl,
        isExample: true,
      });
    }

    const allBiz = await storage.getBusinesses();
    const goldBiz = allBiz.find(b => b.membershipTier === "premium");
    const silverBiz = allBiz.find(b => b.membershipTier === "standard");
    const bronzeBiz = allBiz.find(b => b.membershipTier === "basic");

    await storage.createEvent({
      title: "Moyock Spring Home & Garden Expo 2026",
      description: "Join us for the biggest home improvement event of the season! Over 40 local vendors showcasing everything from custom renovations and landscaping to smart home technology. Free admission, live demos, kids zone, food trucks, and exclusive show-only discounts from Moyock's top contractors. Whether you're planning a full remodel or just looking for inspiration, this is the can't-miss event of the spring.",
      date: new Date(Date.now() + 86400000 * 7),
      location: "Moyock Civic Center, 100 Civic Center Dr",
      city: "Moyock",
      state: "NC",
      zipCode: "27958",
      imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800&h=500&fit=crop",
      flyerUrl: null,
      adSize: "large",
      businessId: goldBiz?.id,
      targetZipCodes: ["27958"],
      isExample: true,
    });

    await storage.createEvent({
      title: "Currituck County Farmers Market — Opening Day",
      description: "Kick off the 2026 market season with over 25 local farmers, artisans, and food vendors! Enjoy farm-fresh produce, handmade crafts, kettle corn, live bluegrass music, and a petting zoo for the kids. Support local growers and makers every Saturday through October.",
      date: new Date(Date.now() + 86400000 * 14),
      location: "Moyock Town Square, Caratoke Hwy",
      city: "Moyock",
      state: "NC",
      zipCode: "27958",
      imageUrl: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800&h=500&fit=crop",
      adSize: "medium",
      businessId: silverBiz?.id,
      targetZipCodes: ["27958"],
      isExample: true,
    });

    await storage.createEvent({
      title: "Free Lawn Care & Spring Planting Workshop",
      description: "Learn native plant landscaping tips, soil prep techniques, and seasonal lawn care from certified horticulturists. Hands-on demonstrations and free seed packets for all attendees.",
      date: new Date(Date.now() + 86400000 * 21),
      location: "Moyock Public Library, 200 Library Ln",
      city: "Moyock",
      state: "NC",
      zipCode: "27958",
      imageUrl: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=800&h=500&fit=crop",
      adSize: "small",
      businessId: bronzeBiz?.id,
      targetZipCodes: ["27958"],
      isExample: true,
    });

    const seededBusinesses = await storage.getBusinesses();
    const plumbingBiz = seededBusinesses.find(b => b.name === "Coastal Plumbing Co");
    const landscapeBiz = seededBusinesses.find(b => b.name === "Sandy Shores Landscaping");
    const hvacBiz = seededBusinesses.find(b => b.name === "Moyock HVAC Pros");

    const exampleJobs = [
      {
        businessId: plumbingBiz?.id || seededBusinesses[0]?.id,
        title: "Licensed Plumber — Full-Time",
        description: "We're looking for a licensed plumber to join our growing team. Must have valid NC plumbing license, 3+ years of residential experience, and a clean driving record. Competitive pay ($25–$35/hr), health benefits, paid time off, and company vehicle provided. We serve Moyock, Chesapeake, and surrounding areas.",
        contactPhone: "(252) 555-0101",
        contactEmail: "jobs@coastalplumbingco.example.com",
        isActive: true,
        imageUrl: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600&h=400&fit=crop",
      },
      {
        businessId: landscapeBiz?.id || seededBusinesses[1]?.id,
        title: "Landscape Crew Member — Seasonal",
        description: "Seasonal position from April through November. Help with mowing, mulching, planting, and hardscape installation. No experience required — we'll train! Must be able to lift 50 lbs and work outdoors in summer heat. $15–$20/hr depending on experience. Great for students or anyone who loves working outside.",
        contactPhone: "(252) 555-0202",
        contactEmail: "hire@sandyshores.example.com",
        isActive: true,
        imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600&h=400&fit=crop",
      },
      {
        businessId: hvacBiz?.id || seededBusinesses[2]?.id,
        title: "HVAC Technician — Immediate Opening",
        description: "Moyock HVAC Pros is hiring an experienced HVAC technician. EPA 608 certification required. We specialize in residential installation and repair across Currituck County. Offering $28–$40/hr based on experience, sign-on bonus, and year-round work. On-call rotation with extra pay. Company truck and tools provided.",
        contactPhone: "(252) 555-0303",
        contactEmail: "careers@moyockhvac.example.com",
        isActive: true,
        imageUrl: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&h=400&fit=crop",
      },
    ];

    for (const job of exampleJobs) {
      await storage.createJobListing(job as any);
    }
    console.log("Seeded 3 example job listings!");

    console.log("Database seeded with 26 placeholder businesses, 3 events, and 3 job listings!");
  } else {
    const existingJobs = await storage.getActiveJobListings();
    if (existingJobs.length === 0) {
      const plumbingBiz = existingBusinesses.find(b => b.name === "Coastal Plumbing Co");
      const landscapeBiz = existingBusinesses.find(b => b.name === "Sandy Shores Landscaping");
      const hvacBiz = existingBusinesses.find(b => b.name === "Moyock HVAC Pros");
      if (plumbingBiz || landscapeBiz || hvacBiz) {
        console.log("Seeding example job listings...");
        const jobsToSeed = [
          plumbingBiz && {
            businessId: plumbingBiz.id,
            title: "Licensed Plumber — Full-Time",
            description: "We're looking for a licensed plumber to join our growing team. Must have valid NC plumbing license, 3+ years of residential experience, and a clean driving record. Competitive pay ($25–$35/hr), health benefits, paid time off, and company vehicle provided.",
            contactPhone: "(252) 555-0101",
            contactEmail: "jobs@coastalplumbingco.example.com",
            isActive: true,
            imageUrl: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=600&h=400&fit=crop",
          },
          landscapeBiz && {
            businessId: landscapeBiz.id,
            title: "Landscape Crew Member — Seasonal",
            description: "Seasonal position from April through November. Help with mowing, mulching, planting, and hardscape installation. No experience required — we'll train! Must be able to lift 50 lbs and work outdoors in summer heat. $15–$20/hr depending on experience.",
            contactPhone: "(252) 555-0202",
            contactEmail: "hire@sandyshores.example.com",
            isActive: true,
            imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=600&h=400&fit=crop",
          },
          hvacBiz && {
            businessId: hvacBiz.id,
            title: "HVAC Technician — Immediate Opening",
            description: "Moyock HVAC Pros is hiring an experienced HVAC technician. EPA 608 certification required. Offering $28–$40/hr based on experience, sign-on bonus, and year-round work. On-call rotation with extra pay. Company truck and tools provided.",
            contactPhone: "(252) 555-0303",
            contactEmail: "careers@moyockhvac.example.com",
            isActive: true,
            imageUrl: "https://images.unsplash.com/photo-1621905252507-b35492cc74b4?w=600&h=400&fit=crop",
          },
        ].filter(Boolean);
        for (const job of jobsToSeed) {
          await storage.createJobListing(job as any);
        }
        console.log(`Seeded ${jobsToSeed.length} example job listings!`);
      }
    }

    const nonExampleSeeds = existingBusinesses.filter(b => !b.isExample && b.imageUrl?.includes("unsplash.com"));
    if (nonExampleSeeds.length > 0) {
      console.log(`Marking ${nonExampleSeeds.length} seed businesses as examples...`);
      const ids = nonExampleSeeds.map(b => b.id);
      await pgDb.update(businesses).set({ isExample: true }).where(inArray(businesses.id, ids));
      console.log("Done marking seed businesses as examples.");
    }
  }

  try {
    const allPromos = await pgDb.select().from(promoCodes);
    const allUsages = await pgDb.select().from(promoCodeUsages);
    const activeBiz = await pgDb.select({ id: businesses.id, stripeSubscriptionId: businesses.stripeSubscriptionId }).from(businesses).where(isNotNull(businesses.stripeSubscriptionId));

    for (const biz of activeBiz) {
      if (!biz.stripeSubscriptionId) continue;
      try {
        const stripe = (await import("stripe")).default;
        const stripeClient = new stripe(process.env.Stripeintegration as string);
        const sub = await stripeClient.subscriptions.retrieve(biz.stripeSubscriptionId);
        const sessionList = await stripeClient.checkout.sessions.list({ subscription: biz.stripeSubscriptionId, limit: 1 });
        const session = sessionList.data[0];
        if (!session?.metadata?.promoCodeId) continue;
        const promoCodeId = parseInt(session.metadata.promoCodeId);
        const hasUsage = allUsages.some(u => u.promoCodeId === promoCodeId && u.businessId === biz.id);
        if (!hasUsage) {
          await pgDb.insert(promoCodeUsages).values({ promoCodeId, businessId: biz.id, stripeSessionId: session.id });
          await pgDb.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1` }).where(eq(promoCodes.id, promoCodeId));
          console.log(`[RECONCILE] Promo code ${promoCodeId} usage recorded for business ${biz.id}`);
        }
      } catch (e) {}
    }
  } catch (e) {
    console.log("Promo reconciliation skipped:", (e as any)?.message);
  }
}
