import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean, serial, text, integer, decimal } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
// Local 365 Elite Status tiers:
// - member: Free to join, base level
// - silver: 10 visits/year OR 25,000 points/year (annual) | 100 visits lifetime (lifetime)
// - gold: 25 visits/year OR 50,000 points/year (annual) | 250 visits lifetime (lifetime)
// - platinum: 50 visits/year OR 100,000 points/year (annual) | 500 visits lifetime (lifetime)
// - ambassador: 100 visits/year + $20k spend (annual) | 1000 visits + $100k lifetime (lifetime)
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  accountType: varchar("account_type").default("customer"), // customer, business
  isValidated: boolean("is_validated").default(false),
  linkedBusinessId: integer("linked_business_id"), // For business accounts - links to their business listing
  
  // Annual Status (resets each year)
  annualPoints: integer("annual_points").default(0), // Points earned this year
  annualVisits: integer("annual_visits").default(0), // Business visits this year
  annualSpent: decimal("annual_spent", { precision: 10, scale: 2 }).default("0"), // Spent this year
  annualTier: varchar("annual_tier").default("member"), // member, silver, gold, platinum, ambassador
  statusYear: integer("status_year"), // The year these annual stats are for (e.g., 2026)
  
  // Lifetime Status (accumulates forever)
  lifetimePoints: integer("lifetime_points").default(0), // Total points ever earned
  lifetimeVisits: integer("lifetime_visits").default(0), // Total business visits ever
  lifetimeSpent: decimal("lifetime_spent", { precision: 10, scale: 2 }).default("0"), // Total spent lifetime
  lifetimeTier: varchar("lifetime_tier").default("member"), // member, silver, gold, platinum, ambassador
  
  // Legacy fields (keeping for backwards compatibility)
  loyaltyPoints: integer("loyalty_points").default(0), // Deprecated - use annualPoints/lifetimePoints
  loyaltyTier: varchar("loyalty_tier").default("member"), // Effective tier (higher of annual or lifetime)
  
  customerRating: decimal("customer_rating", { precision: 2, scale: 1 }).default("5.0"), // 1.0-5.0 rating from businesses
  projectsCompleted: integer("projects_completed").default(0), // Track completed projects
  totalSpent: decimal("total_spent", { precision: 10, scale: 2 }).default("0"), // Total amount spent on projects
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Receipts table for proof of purchase uploads
export const receipts = pgTable("receipts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  status: varchar("status").default("pending"), // pending, approved, rejected
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

// Quote requests - customers post requests for services
export const quoteRequests = pgTable("quote_requests", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  category: varchar("category").notNull(), // matches business categories
  budget: varchar("budget"), // optional budget range
  timeline: varchar("timeline"), // e.g., "Within a week", "Flexible"
  location: text("location"),
  status: varchar("status").default("open"), // open, in_progress, completed, cancelled
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Quotes/bids from businesses
export const quotes = pgTable("quotes", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => quoteRequests.id),
  businessId: integer("business_id").notNull(), // references businesses table
  userId: varchar("user_id").notNull().references(() => users.id), // the business owner
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  message: text("message").notNull(),
  estimatedDuration: varchar("estimated_duration"),
  status: varchar("status").default("pending"), // pending, accepted, rejected, withdrawn
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type InsertQuoteRequest = typeof quoteRequests.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;
