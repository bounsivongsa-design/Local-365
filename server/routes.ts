import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import { registerStripeRoutes } from "./stripe";
import OpenAI from "openai";
import db from "./lib/replitDb";
import { db as pgDb } from "./db";
import { users, receipts, quoteRequests, quotes, quotePriorityAssignments, vendorMetrics, EMERGENCY_CATEGORIES, LOW_RATING_THRESHOLD } from "@shared/models/auth";
import { locations, businesses, events, adPlacements, adPricing, comments as commentsTable, posts as postsTable, categoryRequests, insertCategoryRequestSchema, promoCodes, promoCodeUsages, membershipDowngrades, jobListings, insertJobListingSchema, businessAnalytics } from "@shared/schema";
import { eq, desc, and, or, ilike, inArray, sql, asc, isNull, lt, gt, lte } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

// Tier-Based Quote Access Timing (hours after request creation)
const GOLD_ACCESS_WINDOW_HOURS = 48;    // Gold: 1st round, 0-48 hours exclusive
const SILVER_ACCESS_START_HOURS = 48;   // Silver: 2nd round, starts at 48 hours
const SILVER_ACCESS_END_HOURS = 72;     // Silver: 2nd round, ends at 72 hours
const BRONZE_ACCESS_START_HOURS = 72;   // Bronze: 3rd round, starts at 72 hours

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
// Access windows are the same for all categories (Gold 0-48h, Silver 48-72h, Bronze 72+h)
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
    case "basic": return false;
    default: return false;
  }
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
      averageRating: businesses.averageRating,
      reviewCount: businesses.reviewCount,
    })
    .from(businesses)
    .where(
      and(
        eq(businesses.category, category),
        or(
          eq(businesses.membershipTier, "premium"),
          eq(businesses.membershipTier, "standard"),
          eq(businesses.membershipTier, "basic")
        )
      )
    )
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
      
      if (conditions.length === 0) {
        // Default to all events if no filter
        const allEvents = await storage.getEvents();
        return res.json(allEvents);
      }
      
      // Use AND to narrow results when multiple filters are provided
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
    const businesses = await storage.getBusinesses(category, search);
    res.json(businesses);
  });

  app.get(api.businesses.get.path, async (req, res) => {
    const businessId = Number(req.params.id);
    const business = await storage.getBusiness(businessId);
    if (!business) {
      return res.status(404).json({ message: "Business not found" });
    }
    const reviews = await storage.getReviewsForBusiness(businessId);
    res.json({ ...business, reviews });
  });

  app.post(api.businesses.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.businesses.create.input.parse(req.body);

      const existingBiz = await pgDb.select({ id: businesses.id })
        .from(businesses)
        .where(
          and(
            ilike(businesses.name, input.name),
            eq(businesses.zipCode, input.zipCode || "27929")
          )
        )
        .limit(1);

      if (existingBiz.length > 0) {
        return res.status(409).json({ message: "A business with this name already exists in this zip code" });
      }

      const business = await storage.createBusiness(input);
      res.status(201).json(business);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
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

      if (business.membershipTier !== "premium" && business.membershipTier !== "gold") {
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

      const tier = business.membershipTier;
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
    const eventsWithTier = await Promise.all(
      allEvents.map(async (event) => {
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

      if (!user.length || user[0].accountType !== "business") {
        return res.status(403).json({ message: "Only business accounts can create events." });
      }

      if (!user[0].linkedBusinessId) {
        return res.status(403).json({ message: "You must have a linked business to create events." });
      }
      
      const serverBusinessId = user[0].linkedBusinessId;
      const [biz] = await pgDb.select({ zipCode: businesses.zipCode, membershipTier: businesses.membershipTier })
        .from(businesses).where(eq(businesses.id, serverBusinessId)).limit(1);
      if (!biz) {
        return res.status(400).json({ message: "Linked business not found. Please contact support." });
      }
      const businessZipCode = biz.zipCode;

      const tier = biz.membershipTier;
      const isSilverPlus = tier === "standard" || tier === "premium";
      const isGold = tier === "premium";

      const { businessId: _clientBusinessId, targetZipCodes: _clientTargetZips, adDuration: _adDuration, adSize: _adSize, ...bodyWithoutMeta } = req.body;

      const sanitizedBody = {
        ...bodyWithoutMeta,
        description: isSilverPlus ? (bodyWithoutMeta.description || "") : "",
        imageUrl: isSilverPlus ? bodyWithoutMeta.imageUrl : undefined,
        flyerUrl: isGold ? bodyWithoutMeta.flyerUrl : undefined,
      };

      const eventZipCode = businessZipCode || req.body.zipCode || "27929";

      const input = api.events.create.input.parse({
          ...sanitizedBody,
          businessId: serverBusinessId,
          date: new Date(req.body.date),
          zipCode: eventZipCode,
          targetZipCodes: [eventZipCode],
      });
      const event = await storage.createEvent(input);
      res.status(201).json(event);
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
      
      // Check if user is validated before allowing post
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0 || !user[0].isValidated) {
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
      const input = api.reviews.create.input.parse(req.body);
      if (!input.receiptUrl) {
        return res.status(400).json({ message: "A receipt or proof of purchase is required to submit a review." });
      }
      const review = await storage.createReview({
        ...input,
        userId: (req as any).user?.id,
        businessId: businessId,
      });
      res.status(201).json(review);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
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

  // Ziggy AI Chat API (streaming)
  app.post('/api/chat/ziggy', async (req, res) => {
    try {
      const { message, history = [] } = req.body;

      if (!message) {
        return res.status(400).json({ message: 'Message is required' });
      }

      // Build conversation with Ziggy's system prompt
      const systemPrompt = `You are Ziggy, a friendly and knowledgeable AI assistant who is an expert on Moyock, NC and the surrounding area. You help visitors and locals with:

- Restaurant recommendations (local dining spots, seafood restaurants, cafes in Moyock)
- Beach information and activities (Corolla wild horses, fishing, kayaking on the sound)
- Local attractions (Currituck Beach Lighthouse, Whalehead Club, Historic Corolla, Mackay Island Wildlife Refuge)
- Things to do in Moyock, Barco, Grandy, Coinjock, Knotts Island, Jarvisburg, and other nearby communities
- Weather and seasonal information for the area
- Contractor and home service referrals (deck building $6K-$15K typical)
- Fishing charters and water sports on the sound and ocean
- Family-friendly activities in Moyock and nearby areas

You focus on Moyock, NC and the surrounding communities — including Currituck, Barco, Maple, Shawboro, Grandy, Jarvisburg, Point Harbor, Coinjock, Aydlett, Poplar Branch, Corolla, Carova Beach, and Knotts Island. Do NOT provide recommendations for Outer Banks towns far outside the area (such as Kill Devil Hills, Nags Head, Kitty Hawk, Manteo, or Hatteras). If asked about those areas, let the user know that Local List 365 focuses on Moyock and redirect to local options.

Keep responses helpful, warm, and concise. Use a casual, friendly tone. When recommending businesses or services, offer to connect users with local pros when appropriate.`;

      const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
        { role: 'system', content: systemPrompt },
        ...history.map((h: { sender: string; text: string }) => ({
          role: h.sender === 'user' ? 'user' as const : 'assistant' as const,
          content: h.text,
        })),
        { role: 'user', content: message },
      ];

      // Set up SSE
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');

      const stream = await openai.chat.completions.create({
        model: 'gpt-5.2',
        messages,
        stream: true,
        max_completion_tokens: 500,
      });

      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          res.write(`data: ${JSON.stringify({ content })}\n\n`);
        }
      }

      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
    } catch (error) {
      console.error('Ziggy chat error:', error);
      if (res.headersSent) {
        res.write(`data: ${JSON.stringify({ error: 'Failed to get response' })}\n\n`);
        res.end();
      } else {
        res.status(500).json({ message: 'Failed to get AI response' });
      }
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
          const [linkedBusiness] = await pgDb.select({ membershipTier: businesses.membershipTier })
            .from(businesses).where(eq(businesses.id, linkedBusinessId)).limit(1);
          
          const bizTier = linkedBusiness?.membershipTier || "none";
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
          
          // Only include contact info for businesses with priority access
          if (hasPriorityAccess) {
            customerContact = {
              phone: request.customerPhone,
              email: request.customerEmail
            };
          }
        }
        
        // Get quote count for this request
        const quoteCount = await pgDb.select({ count: quotes.id }).from(quotes)
          .where(eq(quotes.requestId, request.id));
        
        // Get lowest quote amount
        const allQuotes = await pgDb.select({ amount: quotes.amount }).from(quotes)
          .where(eq(quotes.requestId, request.id));
        const lowestQuote = allQuotes.length > 0 
          ? Math.min(...allQuotes.map(q => Number(q.amount)))
          : null;
        
        // Calculate response window info
        const isEmergency = request.isEmergency || false;
        const responseWindowHours = getResponseWindowHours(request.category);
        
        return {
          ...request,
          customer: customerInfo,
          customerContact,
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
      
      const { title, description, category, budget, timeline, location, phone, email, customerName } = req.body;
      if (!title || !description || !category) {
        return res.status(400).json({ message: "Title, description, and category are required" });
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
        status: "open",
        isEmergency,
        customerName: customerName || null,
        customerPhone: phone || null,
        customerEmail: email || user[0]?.email || null,
        priorityRound: 1,
        priorityExpiresAt
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
      
      const requestQuotes = await pgDb.select().from(quotes)
        .where(eq(quotes.requestId, requestId))
        .orderBy(quotes.amount); // Order by price (lowest first for bidding war)
      
      // Enrich with business info
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
      
      if (!amount || !message) {
        return res.status(400).json({ message: "Amount and message are required" });
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
        amount: amount.toString(),
        message,
        estimatedDuration,
        status: "pending",
        responseTimeMinutes,
        wasPriorityResponse
      }).returning();
      
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
          eq(adPlacements.paymentStatus, "paid")
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

      const { placementType, title, description, imageUrl, videoUrl, linkUrl, category, startDate, endDate, adSize } = req.body;

      if (!placementType || !title) {
        return res.status(400).json({ message: "Placement type and title are required" });
      }

      const validSizes = ["small", "medium", "large"];
      const size = validSizes.includes(adSize) ? adSize : "small";

      // Get price from server-side pricing table (don't trust client)
      const [pricing] = await pgDb.select()
        .from(adPricing)
        .where(eq(adPricing.placementType, placementType));
      
      if (!pricing) {
        return res.status(400).json({ message: "Invalid placement type" });
      }

      const AD_MONTHLY_PRICING: Record<string, number> = { small: 25000, medium: 50000, large: 100000 };
      const monthlyPrice = AD_MONTHLY_PRICING[size] || 25000;

      const [biz] = await pgDb.select({ zipCode: businesses.zipCode, membershipTier: businesses.membershipTier })
        .from(businesses).where(eq(businesses.id, user.linkedBusinessId)).limit(1);
      const businessZip = biz?.zipCode || "27929";

      const tierDiscounts: Record<string, number> = { basic: 0.10, standard: 0.25, premium: 0.50 };
      const discount = tierDiscounts[biz?.membershipTier || "none"] || 0;
      const discountedMonthly = Math.round(monthlyPrice * (1 - discount));

      let validatedVideoUrl: string | null = null;
      if (videoUrl) {
        const tierVideoLimits: Record<string, number> = { basic: 10, standard: 20, premium: 30 };
        const videoLimit = tierVideoLimits[biz?.membershipTier || "none"] || 0;
        if (videoLimit === 0) {
          return res.status(403).json({ message: "Video ads require a membership (Bronze, Silver, or Gold)" });
        }
        validatedVideoUrl = videoUrl;
      }

      const [newAd] = await pgDb.insert(adPlacements).values({
        businessId: user.linkedBusinessId,
        placementType,
        adSize: size,
        title,
        description,
        imageUrl,
        videoUrl: validatedVideoUrl,
        linkUrl,
        category,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        pricePerWeek: pricing.pricePerWeek,
        priceMonthly: discountedMonthly,
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

      if (ad.status !== "pending" && ad.status !== "expired") {
        return res.status(400).json({ message: "Only pending or expired ads can be edited." });
      }

      const { title, description, imageUrl, videoUrl, linkUrl, adSize } = req.body;
      const updates: any = { updatedAt: new Date() };
      if (title !== undefined) updates.title = title;
      if (description !== undefined) updates.description = description;
      if (imageUrl !== undefined) updates.imageUrl = imageUrl;
      if (videoUrl !== undefined) updates.videoUrl = videoUrl;
      if (linkUrl !== undefined) updates.linkUrl = linkUrl;
      if (adSize && ["small", "medium", "large"].includes(adSize)) {
        updates.adSize = adSize;
        const AD_MONTHLY_PRICING: Record<string, number> = { small: 25000, medium: 50000, large: 100000 };
        const [biz] = await pgDb.select({ membershipTier: businesses.membershipTier })
          .from(businesses).where(eq(businesses.id, user.linkedBusinessId)).limit(1);
        const tierDiscounts: Record<string, number> = { basic: 0.10, standard: 0.25, premium: 0.50 };
        const discount = tierDiscounts[biz?.membershipTier || "none"] || 0;
        updates.priceMonthly = Math.round(AD_MONTHLY_PRICING[adSize] * (1 - discount));
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
      if (event.businessId && event.businessId !== user.linkedBusinessId) {
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

  // Get all ad requests (admin)
  app.get("/api/admin/ads", isAuthenticated, async (req, res) => {
    try {
      // Check if user is admin from database
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const [dbUser] = await pgDb.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, userId));
      
      if (!dbUser?.isAdmin) {
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
      
      const [dbUser] = await pgDb.select({ isAdmin: users.isAdmin })
        .from(users)
        .where(eq(users.id, userId));
      
      if (!dbUser?.isAdmin) {
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
      if (!user[0]?.isAdmin) {
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
      if (!user[0]?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const { code, description, discountType, discountValue, applicableTiers, maxUses, startsAt, expiresAt } = req.body;
      if (!code || !discountValue) {
        return res.status(400).json({ message: "Code and discount value are required" });
      }
      if (discountType === "percentage" && (discountValue < 1 || discountValue > 100)) {
        return res.status(400).json({ message: "Percentage discount must be between 1 and 100" });
      }
      const existing = await pgDb.select({ id: promoCodes.id }).from(promoCodes).where(eq(promoCodes.code, code.toUpperCase())).limit(1);
      if (existing.length > 0) {
        return res.status(409).json({ message: "A promo code with this code already exists" });
      }
      const [newCode] = await pgDb.insert(promoCodes).values({
        code: code.toUpperCase(),
        description,
        discountType: discountType || "percentage",
        discountValue,
        applicableTiers: applicableTiers || [],
        maxUses: maxUses || null,
        startsAt: startsAt ? new Date(startsAt) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
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
      if (!user[0]?.isAdmin) {
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
      if (!user[0]?.isAdmin) {
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
      const [promo] = await pgDb.select().from(promoCodes).where(eq(promoCodes.code, code.toUpperCase())).limit(1);
      if (!promo) {
        return res.status(404).json({ valid: false, message: "Invalid promo code" });
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
      if (tier && promo.applicableTiers && promo.applicableTiers.length > 0) {
        if (!promo.applicableTiers.includes(tier)) {
          return res.status(400).json({ valid: false, message: `This promo code is not applicable to the ${tier} tier` });
        }
      }
      if (businessId) {
        const existingUsage = await pgDb.select({ id: promoCodeUsages.id }).from(promoCodeUsages)
          .where(and(eq(promoCodeUsages.promoCodeId, promo.id), eq(promoCodeUsages.businessId, businessId))).limit(1);
        if (existingUsage.length > 0) {
          return res.status(400).json({ valid: false, message: "This promo code has already been used by your business" });
        }
      }
      res.json({
        valid: true,
        discountType: promo.discountType,
        discountValue: promo.discountValue,
        description: promo.description,
      });
    } catch (err) {
      console.error("Error validating promo code:", err);
      res.status(500).json({ valid: false, message: "Failed to validate promo code" });
    }
  });

  app.get("/api/membership-downgrades", isAuthenticated, async (req: any, res) => {
    try {
      const user = await pgDb.select().from(users).where(eq(users.id, req.user?.id)).limit(1);
      if (!user[0]?.isAdmin) {
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

  // ============ JOB LISTING ROUTES ============

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

      const [biz] = await pgDb.select({ userId: businesses.userId }).from(businesses).where(eq(businesses.id, businessId)).limit(1);
      const isAdmin = req.user?.isAdmin;
      const isOwner = biz && biz.userId === req.user?.id;
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

  return httpServer;
}

async function seedAdPricing() {
  try {
    const existingPricing = await pgDb.select().from(adPricing);
    if (existingPricing.length === 0) {
      console.log("Seeding ad pricing...");
      await pgDb.insert(adPricing).values([
        {
          placementType: "homepage_banner",
          displayName: "Homepage Banner",
          description: "Large banner ad displayed prominently on the homepage. Maximum visibility for your business.",
          pricePerWeek: 9900, // $99/week
          maxActive: 3,
        },
        {
          placementType: "featured_listing",
          displayName: "Featured Listing",
          description: "Your business appears at the top of directory search results with a 'Featured' badge.",
          pricePerWeek: 4900, // $49/week
          maxActive: 10,
        },
        {
          placementType: "category_spotlight",
          displayName: "Category Spotlight",
          description: "Featured placement within a specific category page. Perfect for targeting your niche.",
          pricePerWeek: 2900, // $29/week
          maxActive: 5,
        },
        {
          placementType: "directory_boost",
          displayName: "Directory Boost",
          description: "Increased visibility in directory listings with priority placement.",
          pricePerWeek: 1900, // $19/week
          maxActive: 20,
        },
        {
          placementType: "large_banner",
          displayName: "Large Homepage Banner",
          description: "Full-width premium banner at the top of the homepage carousel. Maximum visibility and impact.",
          pricePerWeek: 25000, // $250/week ($1,000/mo)
          maxActive: 5,
        },
        {
          placementType: "medium_banner",
          displayName: "Medium Homepage Banner",
          description: "75%-width banner in the homepage carousel. Great visibility at a mid-range price.",
          pricePerWeek: 12500, // $125/week ($500/mo)
          maxActive: 5,
        },
        {
          placementType: "small_banner",
          displayName: "Small Homepage Banner",
          description: "Compact banner in the homepage carousel. Affordable visibility for your business.",
          pricePerWeek: 6250, // $62.50/week ($250/mo)
          maxActive: 5,
        },
      ]);
      console.log("Ad pricing seeded!");
    } else {
      const existingTypes = existingPricing.map(p => p.placementType);
      const newTypes = [
        { placementType: "large_banner", displayName: "Large Homepage Banner", description: "Full-width premium banner at the top of the homepage carousel. Maximum visibility and impact.", pricePerWeek: 25000, maxActive: 5 },
        { placementType: "medium_banner", displayName: "Medium Homepage Banner", description: "75%-width banner in the homepage carousel. Great visibility at a mid-range price.", pricePerWeek: 12500, maxActive: 5 },
        { placementType: "small_banner", displayName: "Small Homepage Banner", description: "Compact banner in the homepage carousel. Affordable visibility for your business.", pricePerWeek: 6250, maxActive: 5 },
      ].filter(t => !existingTypes.includes(t.placementType));
      if (newTypes.length > 0) {
        await pgDb.insert(adPricing).values(newTypes);
        console.log(`Added ${newTypes.length} new ad pricing tiers`);
      }
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
      { name: "Shore Electric", category: "Electrical", description: "Certified electricians for residential and commercial.", address: "404 Courthouse Rd, Currituck", imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop" },
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
      { name: "Coastal Tax Services", category: "Tax CPA", description: "Tax preparation and accounting.", address: "321 Courthouse Rd, Currituck", imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop" },
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
      });
    }

    await storage.createEvent({
      title: "Moyock Home Show",
      description: "Meet local contractors and home service providers.",
      date: new Date(Date.now() + 86400000 * 3),
      location: "Moyock Community Center",
      imageUrl: "https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=800",
    });

    await storage.createEvent({
      title: "Community Farmers Market",
      description: "Fresh veggies, local crafts, and live music.",
      date: new Date(Date.now() + 86400000 * 5),
      location: "Town Square",
      imageUrl: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?w=800",
    });

    console.log("Database seeded with 26 placeholder businesses!");
  }
}
