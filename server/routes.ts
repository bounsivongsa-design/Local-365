import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import { registerObjectStorageRoutes } from "./replit_integrations/object_storage";
import OpenAI from "openai";
import db from "./lib/replitDb";
import { db as pgDb } from "./db";
import { users, receipts, quoteRequests, quotes } from "@shared/models/auth";
import { locations, businesses, events, adPlacements, adPricing } from "@shared/schema";
import { eq, desc, and, or, ilike, inArray } from "drizzle-orm";

const openai = new OpenAI({
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Auth Setup
  await setupAuth(app);
  registerAuthRoutes(app);
  
  // Object Storage Routes
  registerObjectStorageRoutes(app);

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
      
      // Use AND to narrow results when multiple filters are provided
      const locationBusinesses = await pgDb.select().from(businesses).where(and(...conditions));
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

  // Best of OBX
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
          { category: 'Home Repair', winner: 'Smith Home Repair', runnerUp: 'OBX Handyman Services', honorable: 'Beach House Fixers', rating: '4.9' },
          { category: 'Plumbing', winner: 'Coastal Plumbing Co', runnerUp: 'Currituck Plumbing Pros', honorable: 'Island Pipe Works', rating: '4.8' },
          { category: 'HVAC', winner: 'OBX HVAC Pros', runnerUp: 'Coastal Comfort Air', honorable: 'Beach Breeze HVAC', rating: '4.9' },
          { category: 'Electrical', winner: 'Shore Electric', runnerUp: 'Lighthouse Electrical', honorable: 'OBX Power Solutions', rating: '4.7' },
          { category: 'Roofing', winner: 'Barrier Island Roofing', runnerUp: 'Coastal Storm Roofing', honorable: 'OBX Top Roofers', rating: '4.8' },
          { category: 'Landscaping', winner: 'Sandy Shores Landscaping', runnerUp: 'Dune Gardens', honorable: 'Coastal Green Thumb', rating: '4.9' },
          { category: 'Cleaning', winner: 'Crystal Clean OBX', runnerUp: 'Beach Sparkle Cleaning', honorable: 'Tidy Shores Services', rating: '4.8' },
          { category: 'Painting', winner: 'Outer Banks Painters', runnerUp: 'Coastal Colors Pro', honorable: 'Beach House Painting', rating: '4.7' },
          { category: 'Tree Care', winner: 'Coastal Tree Care', runnerUp: 'OBX Arborists', honorable: 'Maritime Tree Service', rating: '4.8' },
          { category: 'Remodeling & Addition', winner: 'Beach House Remodeling', runnerUp: 'OBX Renovations', honorable: 'Coastal Makeover Co', rating: '4.9' },
          { category: 'New Construction', winner: 'OBX Custom Builders', runnerUp: 'Barrier Island Construction', honorable: 'Soundside Builders', rating: '4.8' },
          { category: 'Baby Sitting & Nanny', winner: 'Trusted Nannies OBX', runnerUp: 'Beach Kids Care', honorable: 'Coastal Sitters', rating: '4.9' },
          { category: 'Printing', winner: 'Coastal Print Shop', runnerUp: 'OBX Graphics', honorable: 'Beach Signs & Print', rating: '4.6' },
          { category: 'Web Design & Logo Design', winner: 'Beach Digital Design', runnerUp: 'OBX Web Studio', honorable: 'Coastal Creative Co', rating: '4.8' },
          { category: 'Photo & Video', winner: 'OBX Photo & Video', runnerUp: 'Lighthouse Lens', honorable: 'Sunset Shots OBX', rating: '4.9' },
          { category: 'Auto Repair', winner: 'Reliable Auto Repair', runnerUp: 'Beach Garage', honorable: 'OBX Auto Care', rating: '4.7' },
          { category: 'Small Engine Repair', winner: 'Small Engine Experts', runnerUp: 'OBX Power Equipment', honorable: 'Coastal Motor Works', rating: '4.6' },
          { category: 'Trash & Junk Removal', winner: 'Junk Be Gone OBX', runnerUp: 'Coastal Cleanout', honorable: 'Beach Haul Away', rating: '4.8' },
          { category: 'Tutor & Mentor Counseling', winner: 'OBX Tutoring Center', runnerUp: 'Bright Minds OBX', honorable: 'Coastal Learning', rating: '4.9' },
          { category: 'Mind Body Soul', winner: 'Serenity Wellness', runnerUp: 'Ocean Yoga Studio', honorable: 'Coastal Zen Center', rating: '4.9' },
          { category: 'Tax CPA', winner: 'Coastal Tax Services', runnerUp: 'OBX Accounting', honorable: 'Beach Business CPAs', rating: '4.7' },
          { category: 'Legal', winner: 'Beach Law Group', runnerUp: 'OBX Legal Services', honorable: 'Coastal Attorneys', rating: '4.8' },
          { category: 'Woodworking & Lazer CNC', winner: 'OBX Woodworks', runnerUp: 'Coastal Craftsmen', honorable: 'Beach Timber Creations', rating: '4.9' },
          { category: 'Baking & Cooking', winner: 'Sweet Coastal Bakery', runnerUp: 'Duck Donuts', honorable: 'OBX Bread Company', rating: '4.9' },
          { category: 'Catering Food Trucks', winner: 'Taco Truck OBX', runnerUp: 'Coastal Catering Co', honorable: 'Beach Bites Mobile', rating: '4.8' },
          { category: 'Event Planning & Rentals', winner: 'Coastal Events & Rentals', runnerUp: 'OBX Party Pros', honorable: 'Beach Celebration Co', rating: '4.8' },
        ];
        res.json(defaultBestOf);
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch best of data" });
    }
  });

  // Loyalty Badges
  app.get("/api/loyalty-badges", async (req, res) => {
    try {
      const result = await db.get("loyalty_badges");
      if (result.ok && result.value) {
        res.json(result.value);
      } else {
        // Return default badges if none in DB
        const defaultBadges = [
          { level: 'Silver Visitor', stays: 1, perk: '5% off next booking' },
          { level: 'Gold Visitor', stays: 3, perk: '10% off next booking' },
          { level: 'Platinum Visitor', stays: 5, perk: '15% off next booking' },
          { level: 'Titanium Visitor', stays: 8, perk: '20% off next booking' }
        ];
        res.json(defaultBadges);
      }
    } catch (err) {
      res.status(500).json({ message: "Failed to fetch loyalty badges" });
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
      const business = await storage.createBusiness(input);
      res.status(201).json(business);
    } catch (err) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: err.message });
      }
      throw err;
    }
  });

  // Events
  app.get(api.events.list.path, async (req, res) => {
    const events = await storage.getEvents();
    res.json(events);
  });

  app.post(api.events.create.path, isAuthenticated, async (req, res) => {
    try {
      const input = api.events.create.input.parse({
          ...req.body,
          date: new Date(req.body.date) // Ensure date parsing
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
      const userId = (req.user as any).claims.sub;
      
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

  // Reviews
  app.post(api.reviews.create.path, isAuthenticated, async (req, res) => {
    try {
      const businessId = Number(req.params.id);
      const input = api.reviews.create.input.parse(req.body);
      const review = await storage.createReview({
        ...input,
        userId: (req.user as any).claims.sub,
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
      const systemPrompt = `You are Ziggy, a friendly and knowledgeable AI assistant who is an expert on Currituck County, North Carolina. You help visitors and locals with:

- Restaurant recommendations (local dining spots, seafood restaurants, cafes)
- Beach information and activities (Corolla wild horses, surfing, fishing, kayaking)
- Local attractions (Currituck Beach Lighthouse, Whalehead Club, Historic Corolla)
- Vacation planning (rentals, hotels, best times to visit)
- Weather and seasonal information
- Contractor and home service referrals (deck building $6K-$15K typical)
- Fishing charters and water sports
- Family-friendly activities

Keep responses helpful, warm, and concise. Use a casual, friendly tone. When recommending businesses or services, offer to connect users with local pros when appropriate. If asked about something outside Currituck County, gently redirect to local topics.`;

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

  // ============ ACCOUNT TYPE & LOYALTY ============
  
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

  // Get user profile with loyalty info
  app.get("/api/user/profile", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Calculate tier based on points
      const points = user[0].loyaltyPoints || 0;
      let tier = "explorer";
      if (points >= 5000) tier = "ambassador";
      else if (points >= 2500) tier = "local";
      else if (points >= 1000) tier = "insider";
      else if (points >= 250) tier = "resident";
      
      res.json({
        ...user[0],
        loyaltyTier: tier,
        nextTierPoints: tier === "ambassador" ? null : 
          tier === "local" ? 5000 :
          tier === "insider" ? 2500 :
          tier === "resident" ? 1000 : 250
      });
    } catch (err) {
      console.error("Error fetching user profile:", err);
      res.status(500).json({ message: "Failed to fetch profile" });
    }
  });

  // Helper function to calculate tier from points
  function calculateTier(points: number): string {
    if (points >= 5000) return "ambassador";
    if (points >= 2500) return "local";
    if (points >= 1000) return "insider";
    if (points >= 250) return "resident";
    return "explorer";
  }

  // Add loyalty points
  app.post("/api/user/loyalty/add-points", isAuthenticated, async (req, res) => {
    try {
      const userId = (req as any).user?.id;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { points, reason } = req.body;
      if (!points || points < 0) {
        return res.status(400).json({ message: "Invalid points value" });
      }
      
      const user = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (user.length === 0) {
        return res.status(404).json({ message: "User not found" });
      }
      
      const newPoints = (user[0].loyaltyPoints || 0) + points;
      const newTier = calculateTier(newPoints);
      
      await pgDb.update(users)
        .set({ loyaltyPoints: newPoints, loyaltyTier: newTier, updatedAt: new Date() })
        .where(eq(users.id, userId));
      
      res.json({ points: newPoints, tier: newTier, added: points, reason });
    } catch (err) {
      console.error("Error adding points:", err);
      res.status(500).json({ message: "Failed to add points" });
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
      if (currentUserId) {
        const userResult = await pgDb.select().from(users).where(eq(users.id, currentUserId)).limit(1);
        currentUser = userResult[0] || null;
      }
      const isBusinessUser = currentUser?.accountType === "business";
      
      // Get all open requests with customer info
      const requests = await pgDb.select().from(quoteRequests)
        .where(eq(quoteRequests.status, "open"))
        .orderBy(desc(quoteRequests.createdAt));
      
      // Enrich with customer info and quote counts
      const enrichedRequests = await Promise.all(requests.map(async (request) => {
        // Only include customer info for business users (privacy protection)
        let customerInfo = null;
        if (isBusinessUser || currentUserId === request.userId) {
          const customerResult = await pgDb.select({
            firstName: users.firstName,
            lastName: users.lastName,
            profileImageUrl: users.profileImageUrl,
            customerRating: users.customerRating,
            projectsCompleted: users.projectsCompleted,
            loyaltyTier: users.loyaltyTier,
            totalSpent: users.totalSpent
          }).from(users).where(eq(users.id, request.userId)).limit(1);
          customerInfo = customerResult[0] || null;
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
        
        return {
          ...request,
          customer: customerInfo,
          quoteCount: quoteCount.length,
          lowestQuote
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
      
      const { title, description, category, budget, timeline, location } = req.body;
      if (!title || !description || !category) {
        return res.status(400).json({ message: "Title, description, and category are required" });
      }
      
      const [newRequest] = await pgDb.insert(quoteRequests).values({
        userId,
        title,
        description,
        category,
        budget,
        timeline,
        location,
        status: "open"
      }).returning();
      
      // Award points for posting a quote request (user already fetched above)
      if (user.length > 0) {
        const newPoints = (user[0].loyaltyPoints || 0) + 10;
        const newTier = calculateTier(newPoints);
        await pgDb.update(users)
          .set({ loyaltyPoints: newPoints, loyaltyTier: newTier })
          .where(eq(users.id, userId));
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
      
      const [newQuote] = await pgDb.insert(quotes).values({
        requestId,
        businessId: effectiveBusinessId,
        userId,
        amount: amount.toString(),
        message,
        estimatedDuration,
        status: "pending"
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
      const { type, category } = req.query;
      const now = new Date();
      
      let query = pgDb.select({
        id: adPlacements.id,
        businessId: adPlacements.businessId,
        placementType: adPlacements.placementType,
        title: adPlacements.title,
        description: adPlacements.description,
        imageUrl: adPlacements.imageUrl,
        linkUrl: adPlacements.linkUrl,
        category: adPlacements.category,
        businessName: businesses.name,
        businessImageUrl: businesses.imageUrl,
      }).from(adPlacements)
        .leftJoin(businesses, eq(adPlacements.businessId, businesses.id))
        .where(and(
          eq(adPlacements.status, "active"),
          eq(adPlacements.paymentStatus, "paid")
        ));
      
      const results = await query;
      
      // Filter by type and category if provided
      let filtered = results;
      if (type && typeof type === "string") {
        filtered = filtered.filter(ad => ad.placementType === type);
      }
      if (category && typeof category === "string") {
        filtered = filtered.filter(ad => !ad.category || ad.category === category);
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
      await pgDb.update(adPlacements)
        .set({ impressions: adPlacements.impressions })
        .where(eq(adPlacements.id, id));
      
      // Increment impressions using raw SQL for atomic update
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

      const { placementType, title, description, imageUrl, linkUrl, category, startDate, endDate, pricePerWeek } = req.body;

      if (!placementType || !title) {
        return res.status(400).json({ message: "Placement type and title are required" });
      }

      const [newAd] = await pgDb.insert(adPlacements).values({
        businessId: user.linkedBusinessId,
        placementType,
        title,
        description,
        imageUrl,
        linkUrl,
        category,
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        pricePerWeek,
        status: "pending",
        paymentStatus: "unpaid",
      }).returning();

      res.json(newAd);
    } catch (err) {
      console.error("Error creating ad request:", err);
      res.status(500).json({ message: "Failed to create ad request" });
    }
  });

  // Get all ad requests (admin)
  app.get("/api/admin/ads", isAuthenticated, async (req, res) => {
    try {
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
      const id = parseInt(req.params.id);
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
      ]);
      console.log("Ad pricing seeded!");
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
      { id: 20, name: "Mind Body Soul", subs: [] },
      { id: 21, name: "Tax CPA", subs: [] },
      { id: 22, name: "Legal", subs: [] },
      { id: 23, name: "Woodworking & Lazer CNC", subs: [] },
      { id: 24, name: "Baking & Cooking", subs: [] },
      { id: 25, name: "Catering Food Trucks", subs: [] },
      { id: 26, name: "Event Planning & Rentals", subs: ["Event Planning", "Event Rentals", "Event Locations"] },
    ];
    await db.set('categories', categories);
    console.log("Categories seeded!");
  }

  const existingBusinesses = await storage.getBusinesses();
  if (existingBusinesses.length === 0) {
    console.log("Seeding businesses for all 26 categories...");
    
    // Placeholder businesses for each of the 26 categories with matching images
    const businessData = [
      { name: "Smith Home Repair", category: "Home Repair", description: "Quality home repair services for the OBX area.", address: "101 Beach Rd, Corolla", imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop" },
      { name: "Coastal Plumbing Co", category: "Plumbing", description: "Licensed plumbers serving Currituck County.", address: "202 Ocean Blvd, Duck", imageUrl: "https://images.unsplash.com/photo-1585704032915-c3400ca199e7?w=400&h=300&fit=crop" },
      { name: "OBX HVAC Pros", category: "HVAC", description: "Heating and cooling experts for beach homes.", address: "303 Dune Dr, Kitty Hawk", imageUrl: "https://images.unsplash.com/photo-1631545308207-4b7e5e573a68?w=400&h=300&fit=crop" },
      { name: "Shore Electric", category: "Electrical", description: "Certified electricians for residential and commercial.", address: "404 Lighthouse Ln, Nags Head", imageUrl: "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=400&h=300&fit=crop" },
      { name: "Barrier Island Roofing", category: "Roofing", description: "Storm-resistant roofing for coastal properties.", address: "505 Sunset Ave, Kill Devil Hills", imageUrl: "https://images.unsplash.com/photo-1632759145351-1d592919f522?w=400&h=300&fit=crop" },
      { name: "Sandy Shores Landscaping", category: "Landscaping", description: "Native plant specialists and lawn care.", address: "606 Palmetto Way, Southern Shores", imageUrl: "https://images.unsplash.com/photo-1558904541-efa843a96f01?w=400&h=300&fit=crop" },
      { name: "Crystal Clean OBX", category: "Cleaning", description: "Vacation rental and residential cleaning.", address: "707 Seabreeze Ct, Corolla", imageUrl: "https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop" },
      { name: "Outer Banks Painters", category: "Painting", description: "Interior and exterior painting for beach homes.", address: "808 Harbor Rd, Wanchese", imageUrl: "https://images.unsplash.com/photo-1562259949-e8e7689d7828?w=400&h=300&fit=crop" },
      { name: "Coastal Tree Care", category: "Tree Care", description: "Tree trimming and removal services.", address: "909 Pine Forest Dr, Manteo", imageUrl: "https://images.unsplash.com/photo-1448375240586-882707db888b?w=400&h=300&fit=crop" },
      { name: "Beach House Remodeling", category: "Remodeling & Addition", description: "Custom renovations and additions.", address: "110 Pelican Way, Duck", imageUrl: "https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=400&h=300&fit=crop" },
      { name: "OBX Custom Builders", category: "New Construction", description: "New home construction specialists.", address: "211 Sandcastle Ln, Corolla", imageUrl: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=400&h=300&fit=crop" },
      { name: "Trusted Nannies OBX", category: "Baby Sitting & Nanny", description: "Background-checked childcare providers.", address: "312 Family Cir, Kitty Hawk", imageUrl: "https://images.unsplash.com/photo-1587616211892-f743fcca64f9?w=400&h=300&fit=crop" },
      { name: "Coastal Print Shop", category: "Printing", description: "Business cards, signs, and custom printing.", address: "413 Commerce St, Kill Devil Hills", imageUrl: "https://images.unsplash.com/photo-1562654501-a0ccc0fc3fb1?w=400&h=300&fit=crop" },
      { name: "Beach Digital Design", category: "Web Design & Logo Design", description: "Websites and branding for local businesses.", address: "514 Tech Park Dr, Nags Head", imageUrl: "https://images.unsplash.com/photo-1467232004584-a241de8bcf5d?w=400&h=300&fit=crop" },
      { name: "OBX Photo & Video", category: "Photo & Video", description: "Wedding and event photography.", address: "615 Shutter Ln, Manteo", imageUrl: "https://images.unsplash.com/photo-1471341971476-ae15ff5dd4ea?w=400&h=300&fit=crop" },
      { name: "Reliable Auto Repair", category: "Auto Repair", description: "Trusted mechanics for all makes and models.", address: "716 Motor Way, Kitty Hawk", imageUrl: "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?w=400&h=300&fit=crop" },
      { name: "Small Engine Experts", category: "Small Engine Repair", description: "Lawn mowers, boats, and power equipment.", address: "817 Workshop Rd, Wanchese", imageUrl: "https://images.unsplash.com/photo-1530124566582-a618bc2615dc?w=400&h=300&fit=crop" },
      { name: "Junk Be Gone OBX", category: "Trash & Junk Removal", description: "Fast and affordable junk removal.", address: "918 Cleanup Ave, Kill Devil Hills", imageUrl: "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=400&h=300&fit=crop" },
      { name: "OBX Tutoring Center", category: "Tutor & Mentor Counseling", description: "Academic support for all ages.", address: "119 Learning Ln, Nags Head", imageUrl: "https://images.unsplash.com/photo-1509062522246-3755977927d7?w=400&h=300&fit=crop" },
      { name: "Serenity Wellness", category: "Mind Body Soul", description: "Yoga, meditation, and holistic health.", address: "220 Zen Way, Duck", imageUrl: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?w=400&h=300&fit=crop" },
      { name: "Coastal Tax Services", category: "Tax CPA", description: "Tax preparation and accounting.", address: "321 Finance Dr, Kitty Hawk", imageUrl: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=400&h=300&fit=crop" },
      { name: "Beach Law Group", category: "Legal", description: "Real estate and business law.", address: "422 Justice Blvd, Manteo", imageUrl: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?w=400&h=300&fit=crop" },
      { name: "OBX Woodworks", category: "Woodworking & Lazer CNC", description: "Custom furniture and laser engraving.", address: "523 Craft Ln, Wanchese", imageUrl: "https://images.unsplash.com/photo-1611095780322-bbc1f7b9f4ce?w=400&h=300&fit=crop" },
      { name: "Sweet Coastal Bakery", category: "Baking & Cooking", description: "Fresh baked goods and custom cakes.", address: "624 Sugar St, Corolla", imageUrl: "https://images.unsplash.com/photo-1509440159596-0249088772ff?w=400&h=300&fit=crop" },
      { name: "Taco Truck OBX", category: "Catering Food Trucks", description: "Mobile catering and food truck services.", address: "725 Flavor Ave, Duck", imageUrl: "https://images.unsplash.com/photo-1565123409695-7b5ef63a2efb?w=400&h=300&fit=crop" },
      { name: "Coastal Events & Rentals", category: "Event Planning & Rentals", description: "Weddings, parties, and tent rentals.", address: "826 Celebration Way, Kill Devil Hills", imageUrl: "https://images.unsplash.com/photo-1519167758481-83f550bb49b3?w=400&h=300&fit=crop" },
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
      title: "OBX Home Show",
      description: "Meet local contractors and home service providers.",
      date: new Date(Date.now() + 86400000 * 3),
      location: "Currituck Community Center",
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
