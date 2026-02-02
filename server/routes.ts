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
      { id: 1, name: "Concrete", subs: ["Driveways", "Patios", "Foundations"] },
      { id: 2, name: "Home Repair", subs: ["General Repairs", "Handyman", "Renovations"] },
      { id: 3, name: "HVAC", subs: ["AC Installation", "Heating", "Duct Cleaning"] },
      { id: 4, name: "Cleaning", subs: ["House Cleaning", "Deep Clean", "Move-out"] },
      { id: 5, name: "Auto Repair", subs: ["Mechanics", "Body Shops", "Oil Change"] },
      { id: 6, name: "Event Planning", subs: ["Weddings", "Parties", "Corporate"] },
      { id: 7, name: "Landscaping", subs: ["Lawn Care", "Tree Service", "Hardscaping"] },
      { id: 8, name: "Plumbing", subs: ["Repairs", "Installation", "Emergency"] },
      { id: 9, name: "Electrical", subs: ["Wiring", "Panel Upgrades", "Lighting"] },
      { id: 10, name: "Roofing", subs: ["Shingles", "Metal", "Repairs"] },
      { id: 11, name: "Painting", subs: ["Interior", "Exterior", "Staining"] },
      { id: 12, name: "Flooring", subs: ["Hardwood", "Tile", "Carpet"] },
      { id: 13, name: "Pest Control", subs: ["Termites", "Rodents", "Mosquitoes"] },
      { id: 14, name: "Pool Services", subs: ["Cleaning", "Repairs", "Installation"] },
      { id: 15, name: "Decks & Patios", subs: ["Building", "Repairs", "Staining"] },
      { id: 16, name: "Windows", subs: ["Replacement", "Cleaning", "Tinting"] },
      { id: 17, name: "Gutters", subs: ["Installation", "Cleaning", "Guards"] },
      { id: 18, name: "Fencing", subs: ["Wood", "Vinyl", "Chain Link"] },
      { id: 19, name: "Garage Doors", subs: ["Installation", "Repairs", "Openers"] },
      { id: 20, name: "Appliance Repair", subs: ["Washer/Dryer", "Refrigerator", "Dishwasher"] },
      { id: 21, name: "Security", subs: ["Cameras", "Alarms", "Smart Home"] },
      { id: 22, name: "Moving", subs: ["Local", "Long Distance", "Packing"] },
      { id: 23, name: "Storage", subs: ["Self Storage", "Climate Control", "Boat/RV"] },
      { id: 24, name: "Catering", subs: ["Weddings", "BBQ", "Seafood"] },
      { id: 25, name: "Photography", subs: ["Weddings", "Portraits", "Real Estate"] },
      { id: 26, name: "Pet Services", subs: ["Grooming", "Boarding", "Walking"] },
      { id: 27, name: "Boat Services", subs: ["Repairs", "Detailing", "Storage"] },
      { id: 28, name: "Real Estate", subs: ["Agents", "Property Management", "Rentals"] },
    ];
    await db.set('categories', categories);
    console.log("Categories seeded!");
  }

  const existingBusinesses = await storage.getBusinesses();
  if (existingBusinesses.length === 0) {
    console.log("Seeding database...");
    
    const b1 = await storage.createBusiness({
      name: "The Daily Grind",
      description: "Artisan coffee shop with locally sourced beans and fresh pastries.",
      address: "123 Main St, Downtown",
      category: "Food",
      imageUrl: "https://images.unsplash.com/photo-1497935586351-b67a49e012bf?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
    });

    const b2 = await storage.createBusiness({
      name: "Green Leaf Market",
      description: "Organic grocery store specializing in local produce.",
      address: "456 Oak Ave, Westside",
      category: "Retail",
      imageUrl: "https://images.unsplash.com/photo-1542838132-92c53300491e?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
    });

    const b3 = await storage.createBusiness({
      name: "City Yoga Studio",
      description: "Peaceful yoga studio offering classes for all levels.",
      address: "789 Pine Ln, Uptown",
      category: "Service",
      imageUrl: "https://images.unsplash.com/photo-1599447421405-0c1741427447?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
    });

    await storage.createEvent({
      title: "Latte Art Workshop",
      description: "Learn how to pour the perfect latte art with our head barista.",
      date: new Date(Date.now() + 86400000 * 2), // 2 days from now
      location: "The Daily Grind",
      imageUrl: "https://images.unsplash.com/photo-1511920170033-f8396924c348?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
      businessId: b1.id,
    });

    await storage.createEvent({
      title: "Community Farmers Market",
      description: "Fresh veggies, local crafts, and live music.",
      date: new Date(Date.now() + 86400000 * 5), // 5 days from now
      location: "Town Square",
      imageUrl: "https://images.unsplash.com/photo-1488459716781-31db52582fe9?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80",
    });

    console.log("Database seeded!");
  }
}
