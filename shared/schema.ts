export * from "./models/auth";
import { pgTable, text, serial, integer, boolean, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { users } from "./models/auth";
import { relations } from "drizzle-orm";

export const categories = pgTable("categories", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  subs: text("subs").array().default([]),
});

export const businesses = pgTable("businesses", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull(),
  address: text("address").notNull(),
  city: text("city").default("Currituck"),
  state: text("state").default("NC"),
  zipCode: text("zip_code").default("27929"),
  category: text("category").notNull(), // 'Food', 'Retail', 'Service', 'Entertainment'
  imageUrl: text("image_url").notNull(),
  verified: boolean("verified").default(false),
  
  // Local 365 Partner Program - perks businesses offer to elite members
  isLocal365Partner: boolean("is_local365_partner").default(false),
  silverPerk: text("silver_perk"), // Perk offered to Silver+ members
  goldPerk: text("gold_perk"), // Perk offered to Gold+ members  
  platinumPerk: text("platinum_perk"), // Perk offered to Platinum+ (e.g., "Local rates", "Free upgrade")
  ambassadorPerk: text("ambassador_perk"), // Exclusive Ambassador perk
});

export const locations = pgTable("locations", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(), // Display name e.g., "Currituck County, NC"
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCodes: text("zip_codes").array().default([]), // Array of zip codes in this location
  region: text("region"), // e.g., "Outer Banks", "Piedmont"
  heroImage: text("hero_image"),
  tagline: text("tagline"),
  isActive: boolean("is_active").default(true),
});

export const events = pgTable("events", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  date: timestamp("date").notNull(),
  location: text("location").notNull(),
  city: text("city").default("Currituck"),
  state: text("state").default("NC"),
  zipCode: text("zip_code").default("27929"),
  imageUrl: text("image_url"),
  businessId: integer("business_id").references(() => businesses.id),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  authorId: varchar("author_id").notNull().references(() => users.id), // Changed to varchar to match users.id
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id), // Changed to varchar to match users.id
  businessId: integer("business_id").notNull().references(() => businesses.id),
  createdAt: timestamp("created_at").defaultNow(),
});

// Relations
export const businessesRelations = relations(businesses, ({ many }) => ({
  events: many(events),
  reviews: many(reviews),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  business: one(businesses, {
    fields: [events.businessId],
    references: [businesses.id],
  }),
}));

export const postsRelations = relations(posts, ({ one }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
}));

export const reviewsRelations = relations(reviews, ({ one }) => ({
  user: one(users, {
    fields: [reviews.userId],
    references: [users.id],
  }),
  business: one(businesses, {
    fields: [reviews.businessId],
    references: [businesses.id],
  }),
}));

// Schemas & Types
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertBusinessSchema = createInsertSchema(businesses).omit({ id: true, verified: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true });
export const insertPostSchema = createInsertSchema(posts).omit({ id: true, createdAt: true, authorId: true, likes: true }); 
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true, userId: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });

export type Category = typeof categories.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;

export type CreateBusinessRequest = z.infer<typeof insertBusinessSchema>;
export type CreateEventRequest = z.infer<typeof insertEventSchema>;
export type CreatePostRequest = z.infer<typeof insertPostSchema>;
export type CreateReviewRequest = z.infer<typeof insertReviewSchema>;

// Complex response types
export type BusinessWithRating = Business & { averageRating: number; reviewCount: number };
export type PostWithAuthor = Post & { author: typeof users.$inferSelect };
export type ReviewWithUser = Review & { user: typeof users.$inferSelect };

// Re-export chat models for AI chat feature
export { conversations, messages, insertConversationSchema, insertMessageSchema } from "./models/chat";
export type { Conversation, Message, InsertConversation, InsertMessage } from "./models/chat";
