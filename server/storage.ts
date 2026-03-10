import { db } from "./db";
import {
  businesses,
  events,
  posts,
  reviews,
  users,
  type Business,
  type CreateBusinessRequest,
  type Event,
  type CreateEventRequest,
  type Post,
  type CreatePostRequest,
  type Review,
  type CreateReviewRequest,
  type BusinessWithRating,
  type PostWithAuthor,
} from "@shared/schema";
import { eq, desc, sql } from "drizzle-orm";
import { authStorage } from "./replit_integrations/auth/storage";

export interface IStorage {
  // Businesses
  getBusinesses(category?: string, search?: string): Promise<BusinessWithRating[]>;
  getBusiness(id: number): Promise<Business | undefined>;
  createBusiness(business: CreateBusinessRequest): Promise<Business>;

  // Events
  getEvents(): Promise<Event[]>;
  createEvent(event: CreateEventRequest): Promise<Event>;

  // Posts
  getPosts(): Promise<PostWithAuthor[]>;
  createPost(post: CreatePostRequest & { authorId: string }): Promise<Post>;
  likePost(id: number): Promise<number>;

  // Reviews
  getReviewsForBusiness(businessId: number): Promise<(Review & { user: typeof users.$inferSelect })[]>;
  createReview(review: CreateReviewRequest & { userId: string, businessId: number }): Promise<Review>;
}

export class DatabaseStorage implements IStorage {
  async getBusinesses(category?: string, search?: string): Promise<BusinessWithRating[]> {
    let query = db.select({
      id: businesses.id,
      name: businesses.name,
      description: businesses.description,
      address: businesses.address,
      city: businesses.city,
      state: businesses.state,
      zipCode: businesses.zipCode,
      category: businesses.category,
      imageUrl: businesses.imageUrl,
      verified: businesses.verified,
      hasLLC: businesses.hasLLC,
      hasInsurance: businesses.hasInsurance,
      isLocal365Partner: businesses.isLocal365Partner,
      silverPerk: businesses.silverPerk,
      goldPerk: businesses.goldPerk,
      platinumPerk: businesses.platinumPerk,
      ambassadorPerk: businesses.ambassadorPerk,
      membershipTier: businesses.membershipTier,
      membershipPaymentFrequency: businesses.membershipPaymentFrequency,
      membershipStartDate: businesses.membershipStartDate,
      membershipEndDate: businesses.membershipEndDate,
      membershipTrialUsed: businesses.membershipTrialUsed,
      phone: businesses.phone,
      websiteUrl: businesses.websiteUrl,
      logoUrl: businesses.logoUrl,
      averageRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
      reviewCount: sql<number>`COUNT(${reviews.id})`
    })
    .from(businesses)
    .leftJoin(reviews, eq(businesses.id, reviews.businessId))
    .groupBy(businesses.id);

    if (category) {
      query.where(eq(businesses.category, category));
    }
    
    // Simple search implementation
    if (search) {
       // In a real app, use ilike or full text search
       // query.where(ilike(businesses.name, `%${search}%`));
    }

    query.orderBy(
      sql`CASE 
        WHEN ${businesses.membershipTier} = 'premium' THEN 1 
        WHEN ${businesses.membershipTier} = 'standard' THEN 2 
        WHEN ${businesses.membershipTier} = 'basic' THEN 3 
        ELSE 4 
      END`,
      sql`COALESCE(AVG(${reviews.rating}), 0) DESC`,
      sql`COUNT(${reviews.id}) DESC`
    );

    const results = await query;
    return results.map(row => ({
      ...row,
      averageRating: Number(row.averageRating),
      reviewCount: Number(row.reviewCount)
    }));
  }

  async getBusiness(id: number): Promise<Business | undefined> {
    const [business] = await db.select().from(businesses).where(eq(businesses.id, id));
    return business;
  }

  async createBusiness(business: CreateBusinessRequest): Promise<Business> {
    const [newBusiness] = await db.insert(businesses).values(business).returning();
    return newBusiness;
  }

  async getEvents(): Promise<Event[]> {
    return await db.select().from(events).orderBy(desc(events.date));
  }

  async createEvent(event: CreateEventRequest): Promise<Event> {
    const [newEvent] = await db.insert(events).values(event).returning();
    return newEvent;
  }

  async getPosts(): Promise<PostWithAuthor[]> {
    return await db.query.posts.findMany({
      with: {
        author: true,
      },
      orderBy: desc(posts.createdAt),
    });
  }

  async createPost(post: CreatePostRequest & { authorId: string }): Promise<Post> {
    const [newPost] = await db.insert(posts).values(post).returning();
    return newPost;
  }

  async likePost(id: number): Promise<number> {
      const [updatedPost] = await db.update(posts)
        .set({ likes: sql`${posts.likes} + 1` })
        .where(eq(posts.id, id))
        .returning({ likes: posts.likes });
      return updatedPost?.likes || 0;
  }

  async getReviewsForBusiness(businessId: number): Promise<(Review & { user: typeof users.$inferSelect })[]> {
    return await db.query.reviews.findMany({
      where: eq(reviews.businessId, businessId),
      with: {
        user: true,
      },
      orderBy: desc(reviews.createdAt),
    });
  }

  async createReview(review: CreateReviewRequest & { userId: string, businessId: number }): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }
}

export const storage = new DatabaseStorage();
