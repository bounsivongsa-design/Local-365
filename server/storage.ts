import { db } from "./db";
import {
  businesses,
  events,
  posts,
  reviews,
  users,
  jobListings,
  adminMessages,
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
  type JobListing,
  type InsertJobListing,
  type JobListingWithBusiness,
  type AdminMessage,
  type InsertAdminMessage,
} from "@shared/schema";
import { eq, desc, sql, and, or, ilike, asc, isNull, inArray } from "drizzle-orm";
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
  getRecentReviews(limit?: number): Promise<(Review & { user: typeof users.$inferSelect; business: typeof businesses.$inferSelect })[]>;
  createReview(review: CreateReviewRequest & { userId: string, businessId: number }): Promise<Review>;

  // Job Listings
  getActiveJobListings(): Promise<JobListingWithBusiness[]>;
  getJobListingsByBusiness(businessId: number): Promise<JobListing[]>;
  getJobListing(id: number): Promise<JobListing | undefined>;
  createJobListing(listing: InsertJobListing): Promise<JobListing>;
  updateJobListing(id: number, updates: Partial<JobListing>): Promise<JobListing | undefined>;
  deleteJobListing(id: number): Promise<void>;

  // Admin <-> Business direct messages (one thread per business).
  getAdminMessageThread(businessId: number): Promise<AdminMessage[]>;
  createAdminMessage(msg: InsertAdminMessage): Promise<AdminMessage>;
  // Mark every message in this thread written by the *other* side as read.
  // role = the role of the viewer (admin sees msgs from business; business
  // sees msgs from admin). Returns the number of rows updated.
  markAdminThreadRead(businessId: number, viewerRole: "admin" | "business"): Promise<number>;
  // Most recent admin->business message (used for the once-per-N-hours
  // email throttle).
  getLastAdminToBusinessMessage(businessId: number): Promise<AdminMessage | undefined>;
  // Listing of every business that has at least one message, with last-msg
  // timestamp + count of unread messages from the business side. Powers the
  // admin "Messages" inbox.
  listAdminMessageThreadsForAdmin(): Promise<Array<{
    businessId: number;
    businessName: string;
    lastMessageAt: Date;
    lastMessageBody: string;
    lastSenderRole: string;
    unreadFromBusiness: number;
  }>>;
  // Number of unread admin->business messages owned by this user across all
  // their business listings. Drives the inbox bell badge.
  getUnreadAdminMessageCountForOwner(ownerUserId: string): Promise<number>;
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
      isVeteran: businesses.isVeteran,
      ownerName: businesses.ownerName,
      searchKeywords: businesses.searchKeywords,
      additionalCategories: businesses.additionalCategories,
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
      isExample: businesses.isExample,
      isFoundingMember: businesses.isFoundingMember,
      foundingMemberNumber: businesses.foundingMemberNumber,
      averageRating: sql<number>`COALESCE(AVG(${reviews.rating}), 0)`,
      reviewCount: sql<number>`COUNT(${reviews.id})`
    })
    .from(businesses)
    .leftJoin(reviews, eq(businesses.id, reviews.businessId))
    .groupBy(businesses.id);

    const conditions = [];
    conditions.push(sql`COALESCE(${businesses.status}, 'active') != 'archived'`);
    conditions.push(
      or(
        sql`${businesses.membershipTier} != 'none'`,
        eq(businesses.isExample, true)
      )!
    );
    if (category) {
      conditions.push(
        or(
          eq(businesses.category, category),
          sql`${category} = ANY(${businesses.additionalCategories})`
        )!
      );
    }
    if (search) {
      const searchPattern = `%${search}%`;
      conditions.push(
        or(
          ilike(businesses.name, searchPattern),
          ilike(businesses.description, searchPattern),
          ilike(businesses.category, searchPattern),
          sql`${businesses.searchKeywords}::text ILIKE ${searchPattern}`,
          sql`${businesses.additionalCategories}::text ILIKE ${searchPattern}`
        )!
      );
    }
    if (conditions.length > 0) {
      query.where(and(...conditions));
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
    const [business] = await db
      .select()
      .from(businesses)
      .where(and(eq(businesses.id, id), sql`COALESCE(${businesses.status}, 'active') != 'archived'`));
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

  async getRecentReviews(limit = 10): Promise<(Review & { user: typeof users.$inferSelect; business: typeof businesses.$inferSelect })[]> {
    return await db.query.reviews.findMany({
      with: {
        user: true,
        business: true,
      },
      orderBy: desc(reviews.createdAt),
      limit,
    });
  }

  async createReview(review: CreateReviewRequest & { userId: string, businessId: number }): Promise<Review> {
    const [newReview] = await db.insert(reviews).values(review).returning();
    return newReview;
  }

  async getActiveJobListings(): Promise<JobListingWithBusiness[]> {
    const listings = await db.query.jobListings.findMany({
      where: eq(jobListings.isActive, true),
      with: {
        business: true,
      },
      orderBy: desc(jobListings.createdAt),
    });

    const tierOrder: Record<string, number> = { premium: 1, standard: 2, basic: 3 };
    return listings.sort((a, b) => {
      const aTier = tierOrder[a.business?.membershipTier || ""] || 4;
      const bTier = tierOrder[b.business?.membershipTier || ""] || 4;
      if (aTier !== bTier) return aTier - bTier;
      return 0;
    });
  }

  async getJobListingsByBusiness(businessId: number): Promise<JobListing[]> {
    return await db.select().from(jobListings)
      .where(eq(jobListings.businessId, businessId))
      .orderBy(desc(jobListings.createdAt));
  }

  async getJobListing(id: number): Promise<JobListing | undefined> {
    const [listing] = await db.select().from(jobListings).where(eq(jobListings.id, id));
    return listing;
  }

  async createJobListing(listing: InsertJobListing): Promise<JobListing> {
    const [newListing] = await db.insert(jobListings).values(listing).returning();
    return newListing;
  }

  async updateJobListing(id: number, updates: Partial<JobListing>): Promise<JobListing | undefined> {
    const [updated] = await db.update(jobListings)
      .set(updates)
      .where(eq(jobListings.id, id))
      .returning();
    return updated;
  }

  async deleteJobListing(id: number): Promise<void> {
    await db.delete(jobListings).where(eq(jobListings.id, id));
  }

  // ----- Admin <-> Business direct messages -----

  async getAdminMessageThread(businessId: number): Promise<AdminMessage[]> {
    return await db
      .select()
      .from(adminMessages)
      .where(eq(adminMessages.businessId, businessId))
      .orderBy(asc(adminMessages.createdAt));
  }

  async createAdminMessage(msg: InsertAdminMessage): Promise<AdminMessage> {
    const [row] = await db.insert(adminMessages).values(msg).returning();
    return row;
  }

  async markAdminThreadRead(
    businessId: number,
    viewerRole: "admin" | "business",
  ): Promise<number> {
    // The viewer reads messages written by the *opposite* role.
    const otherRole = viewerRole === "admin" ? "business" : "admin";
    const result = await db
      .update(adminMessages)
      .set({ readAt: new Date() })
      .where(
        and(
          eq(adminMessages.businessId, businessId),
          eq(adminMessages.senderRole, otherRole),
          isNull(adminMessages.readAt),
        ),
      )
      .returning({ id: adminMessages.id });
    return result.length;
  }

  async getLastAdminToBusinessMessage(businessId: number): Promise<AdminMessage | undefined> {
    const [row] = await db
      .select()
      .from(adminMessages)
      .where(
        and(
          eq(adminMessages.businessId, businessId),
          eq(adminMessages.senderRole, "admin"),
        ),
      )
      .orderBy(desc(adminMessages.createdAt))
      .limit(1);
    return row;
  }

  async listAdminMessageThreadsForAdmin() {
    // Aggregate one row per business that has any admin_messages row,
    // ordered by most-recent activity. Unread count = business->admin
    // messages still unread by admin.
    const rows = await db
      .select({
        businessId: adminMessages.businessId,
        businessName: businesses.name,
        lastMessageAt: sql<Date>`MAX(${adminMessages.createdAt})`,
        unreadFromBusiness: sql<number>`SUM(CASE WHEN ${adminMessages.senderRole} = 'business' AND ${adminMessages.readAt} IS NULL THEN 1 ELSE 0 END)`,
      })
      .from(adminMessages)
      .leftJoin(businesses, eq(businesses.id, adminMessages.businessId))
      .groupBy(adminMessages.businessId, businesses.name)
      .orderBy(desc(sql`MAX(${adminMessages.createdAt})`));

    if (rows.length === 0) return [];

    // Fetch the latest body + sender role per business in a single query.
    const businessIds = rows.map((r) => r.businessId);
    const latestPerBiz = await db.execute<{
      business_id: number;
      body: string;
      sender_role: string;
    }>(sql`
      SELECT DISTINCT ON (business_id) business_id, body, sender_role
      FROM admin_messages
      WHERE business_id IN (${sql.join(businessIds.map((id) => sql`${id}`), sql`, `)})
      ORDER BY business_id, created_at DESC
    `);
    const latestMap = new Map<number, { body: string; senderRole: string }>();
    for (const r of latestPerBiz.rows) {
      latestMap.set(r.business_id, { body: r.body, senderRole: r.sender_role });
    }

    return rows.map((r) => ({
      businessId: r.businessId,
      businessName: r.businessName ?? "(deleted business)",
      lastMessageAt: r.lastMessageAt,
      lastMessageBody: latestMap.get(r.businessId)?.body ?? "",
      lastSenderRole: latestMap.get(r.businessId)?.senderRole ?? "admin",
      unreadFromBusiness: Number(r.unreadFromBusiness ?? 0),
    }));
  }

  async getUnreadAdminMessageCountForOwner(ownerUserId: string): Promise<number> {
    const [row] = await db
      .select({ count: sql<number>`COUNT(*)` })
      .from(adminMessages)
      .innerJoin(businesses, eq(businesses.id, adminMessages.businessId))
      .where(
        and(
          eq(businesses.ownerUserId, ownerUserId),
          eq(adminMessages.senderRole, "admin"),
          isNull(adminMessages.readAt),
        ),
      );
    return Number(row?.count ?? 0);
  }
}

export const storage = new DatabaseStorage();
