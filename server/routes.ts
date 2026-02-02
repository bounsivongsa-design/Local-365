import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";
import OpenAI from "openai";
import db from "./lib/replitDb";

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
      const input = api.posts.create.input.parse(req.body);
      const post = await storage.createPost({
        ...input,
        authorId: (req.user as any).claims.sub,
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

  // Seed Data
  await seedDatabase();

  return httpServer;
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
