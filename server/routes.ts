import type { Express } from "express";
import type { Server } from "http";
import { storage } from "./storage";
import { api } from "@shared/routes";
import { z } from "zod";
import { setupAuth, registerAuthRoutes, isAuthenticated } from "./replit_integrations/auth";

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

  // Seed Data
  await seedDatabase();

  return httpServer;
}

async function seedDatabase() {
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
