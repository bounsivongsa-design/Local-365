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
      const systemPrompt = `You are Ziggy, a friendly and knowledgeable AI assistant who is an expert on the Outer Banks (OBX), North Carolina. You help visitors and locals with:

- Restaurant recommendations (Sam & Omie's, Coastal Provisions, The Blue Point, etc.)
- Beach information and activities (Corolla wild horses, Jockey's Ridge, surfing, fishing)
- Local attractions (Wright Brothers Memorial, NC Aquarium, lighthouses)
- Vacation planning (rentals, hotels, best times to visit)
- Weather and seasonal information
- Contractor and home service referrals (deck building $6K-$15K typical)
- Fishing charters and water sports
- Family-friendly activities

Keep responses helpful, warm, and concise. Use a casual, friendly tone. When recommending businesses or services, offer to connect users with local pros when appropriate. If asked about something outside OBX, gently redirect to OBX topics.`;

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
    
    // Placeholder businesses for each of the 26 categories
    const businessData = [
      { name: "Smith Home Repair", category: "Home Repair", description: "Quality home repair services for the OBX area.", address: "101 Beach Rd, Corolla" },
      { name: "Coastal Plumbing Co", category: "Plumbing", description: "Licensed plumbers serving Currituck County.", address: "202 Ocean Blvd, Duck" },
      { name: "OBX HVAC Pros", category: "HVAC", description: "Heating and cooling experts for beach homes.", address: "303 Dune Dr, Kitty Hawk" },
      { name: "Shore Electric", category: "Electrical", description: "Certified electricians for residential and commercial.", address: "404 Lighthouse Ln, Nags Head" },
      { name: "Barrier Island Roofing", category: "Roofing", description: "Storm-resistant roofing for coastal properties.", address: "505 Sunset Ave, Kill Devil Hills" },
      { name: "Sandy Shores Landscaping", category: "Landscaping", description: "Native plant specialists and lawn care.", address: "606 Palmetto Way, Southern Shores" },
      { name: "Crystal Clean OBX", category: "Cleaning", description: "Vacation rental and residential cleaning.", address: "707 Seabreeze Ct, Corolla" },
      { name: "Outer Banks Painters", category: "Painting", description: "Interior and exterior painting for beach homes.", address: "808 Harbor Rd, Wanchese" },
      { name: "Coastal Tree Care", category: "Tree Care", description: "Tree trimming and removal services.", address: "909 Pine Forest Dr, Manteo" },
      { name: "Beach House Remodeling", category: "Remodeling & Addition", description: "Custom renovations and additions.", address: "110 Pelican Way, Duck" },
      { name: "OBX Custom Builders", category: "New Construction", description: "New home construction specialists.", address: "211 Sandcastle Ln, Corolla" },
      { name: "Trusted Nannies OBX", category: "Baby Sitting & Nanny", description: "Background-checked childcare providers.", address: "312 Family Cir, Kitty Hawk" },
      { name: "Coastal Print Shop", category: "Printing", description: "Business cards, signs, and custom printing.", address: "413 Commerce St, Kill Devil Hills" },
      { name: "Beach Digital Design", category: "Web Design & Logo Design", description: "Websites and branding for local businesses.", address: "514 Tech Park Dr, Nags Head" },
      { name: "OBX Photo & Video", category: "Photo & Video", description: "Wedding and event photography.", address: "615 Shutter Ln, Manteo" },
      { name: "Reliable Auto Repair", category: "Auto Repair", description: "Trusted mechanics for all makes and models.", address: "716 Motor Way, Kitty Hawk" },
      { name: "Small Engine Experts", category: "Small Engine Repair", description: "Lawn mowers, boats, and power equipment.", address: "817 Workshop Rd, Wanchese" },
      { name: "Junk Be Gone OBX", category: "Trash & Junk Removal", description: "Fast and affordable junk removal.", address: "918 Cleanup Ave, Kill Devil Hills" },
      { name: "OBX Tutoring Center", category: "Tutor & Mentor Counseling", description: "Academic support for all ages.", address: "119 Learning Ln, Nags Head" },
      { name: "Serenity Wellness", category: "Mind Body Soul", description: "Yoga, meditation, and holistic health.", address: "220 Zen Way, Duck" },
      { name: "Coastal Tax Services", category: "Tax CPA", description: "Tax preparation and accounting.", address: "321 Finance Dr, Kitty Hawk" },
      { name: "Beach Law Group", category: "Legal", description: "Real estate and business law.", address: "422 Justice Blvd, Manteo" },
      { name: "OBX Woodworks", category: "Woodworking & Lazer CNC", description: "Custom furniture and laser engraving.", address: "523 Craft Ln, Wanchese" },
      { name: "Sweet Coastal Bakery", category: "Baking & Cooking", description: "Fresh baked goods and custom cakes.", address: "624 Sugar St, Corolla" },
      { name: "Taco Truck OBX", category: "Catering Food Trucks", description: "Mobile catering and food truck services.", address: "725 Flavor Ave, Duck" },
      { name: "Coastal Events & Rentals", category: "Event Planning & Rentals", description: "Weddings, parties, and tent rentals.", address: "826 Celebration Way, Kill Devil Hills" },
    ];

    for (const biz of businessData) {
      await storage.createBusiness({
        name: biz.name,
        description: biz.description,
        address: biz.address,
        category: biz.category,
        imageUrl: `https://images.unsplash.com/photo-1560472354-b33ff0c44a43?w=400&h=300&fit=crop`,
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
