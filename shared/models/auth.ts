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
  passwordHash: varchar("password_hash"),
  googleId: varchar("google_id"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  accountType: varchar("account_type").default("customer"), // customer, business, admin
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
  isAdmin: boolean("is_admin").default(false),
  stripeCustomerId: varchar("stripe_customer_id"),
  pendingMembershipTier: varchar("pending_membership_tier"),
  pendingStripeSubscriptionId: varchar("pending_stripe_subscription_id"),
  pendingPaymentFrequency: varchar("pending_payment_frequency"),
  pendingBusinessName: varchar("pending_business_name"),
  // When the pending-membership fields above were first set (checkout
  // completed but the business listing was never finished). Lets the
  // abandoned-checkout job (routes.ts: checkAbandonedBusinessCheckouts)
  // know how long someone's been charged with nothing on file — without
  // this, a paid-but-incomplete signup can sit charged forever.
  pendingSince: timestamp("pending_since"),
  // Gates the one-time "finish your listing" reminder email so it doesn't
  // resend every hourly sweep. Reset to false whenever pendingSince is
  // cleared (business completed, or subscription auto-cancelled) so a
  // future pending cycle gets its own fresh reminder.
  pendingReminderSent: boolean("pending_reminder_sent").default(false),
  
  // Community Engagement Badges (like Facebook Groups)
  // Badges: top_contributor, conversation_starter, rising_star, founding_member, helpful_neighbor
  engagementBadge: varchar("engagement_badge"), // Primary badge displayed
  postCount: integer("post_count").default(0), // Total posts created
  commentCount: integer("comment_count").default(0), // Total comments made
  likesReceived: integer("likes_received").default(0), // Total likes received on posts/comments
  memberSince: timestamp("member_since").defaultNow(), // For founding member badge
  
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

export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  token: varchar("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Emergency categories that require 2-hour response window instead of 24 hours
export const EMERGENCY_CATEGORIES = ["HVAC", "Electrical", "Plumbing", "Roofing"];

// Customer rating threshold below which vendors aren't penalized for slow response
export const LOW_RATING_THRESHOLD = 3.0;

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
  address: text("address"),
  status: varchar("status").default("open"), // open, in_progress, completed, cancelled
  isEmergency: boolean("is_emergency").default(false), // True for HVAC, electrical, plumbing emergencies
  customerName: text("customer_name"), // Name of the person requesting the quote
  customerPhone: text("customer_phone"), // Contact info for premium vendors
  customerEmail: text("customer_email"), // Contact info for premium vendors
  priorityRound: integer("priority_round").default(1), // Current priority round (1 = first 5 premium, 2 = next 5, etc.)
  priorityExpiresAt: timestamp("priority_expires_at"), // When current priority round expires
  maxQuotes: integer("max_quotes"), // Max number of quotes customer wants (5, 10, or null = unlimited up to 10 business days)
  receivedQuotesCount: integer("received_quotes_count").default(0), // Current count of quotes received
  customerOptedOut: boolean("customer_opted_out").default(false), // Customer cancelled/opted out of this request
  createdAt: timestamp("created_at").defaultNow(),
  expiresAt: timestamp("expires_at"),
});

// Priority queue assignments - tracks which businesses have priority access to quote requests
export const quotePriorityAssignments = pgTable("quote_priority_assignments", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => quoteRequests.id),
  businessId: integer("business_id").notNull(), // references businesses table
  priorityRound: integer("priority_round").notNull().default(1), // Which round (1 = first 5 premium, 2 = next 5)
  assignedAt: timestamp("assigned_at").defaultNow(),
  expiresAt: timestamp("expires_at").notNull(), // When priority access expires (2h emergency, 24h standard)
  respondedAt: timestamp("responded_at"), // When business submitted quote (null if no response)
  expired: boolean("expired").default(false), // True if window expired without response
  customerRatingAtTime: decimal("customer_rating_at_time", { precision: 2, scale: 1 }), // Customer rating when assigned
});

// Vendor response metrics - tracks overall response performance for ranking
export const vendorMetrics = pgTable("vendor_metrics", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().unique(), // references businesses table
  totalAssignments: integer("total_assignments").default(0), // Total priority assignments received
  responsesOnTime: integer("responses_on_time").default(0), // Responses within window
  responsesLate: integer("responses_late").default(0), // Responses after window expired
  noResponses: integer("no_responses").default(0), // No response at all
  averageResponseMinutes: integer("average_response_minutes"), // Average time to respond in minutes
  responseRating: decimal("response_rating", { precision: 3, scale: 2 }).default("5.00"), // 0-5 rating based on timeliness
  penaltyExemptNoResponses: integer("penalty_exempt_no_responses").default(0), // No responses to low-rated customers (not penalized)
  lastUpdated: timestamp("last_updated").defaultNow(),
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
  responseTimeMinutes: integer("response_time_minutes"), // How long it took to respond from assignment
  wasPriorityResponse: boolean("was_priority_response").default(false), // True if responded during priority window
  businessOptedOut: boolean("business_opted_out").default(false), // Business withdrew/opted out of this quote
  createdAt: timestamp("created_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type Receipt = typeof receipts.$inferSelect;
export type QuoteRequest = typeof quoteRequests.$inferSelect;
export type InsertQuoteRequest = typeof quoteRequests.$inferInsert;
export type Quote = typeof quotes.$inferSelect;
export type InsertQuote = typeof quotes.$inferInsert;
export type QuotePriorityAssignment = typeof quotePriorityAssignments.$inferSelect;
export type InsertQuotePriorityAssignment = typeof quotePriorityAssignments.$inferInsert;
export type VendorMetrics = typeof vendorMetrics.$inferSelect;
export type InsertVendorMetrics = typeof vendorMetrics.$inferInsert;

export const quoteMessages = pgTable("quote_messages", {
  id: serial("id").primaryKey(),
  quoteId: integer("quote_id").notNull().references(() => quotes.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type QuoteMessage = typeof quoteMessages.$inferSelect;
export type InsertQuoteMessage = typeof quoteMessages.$inferInsert;

export const directConversations = pgTable("direct_conversations", {
  id: serial("id").primaryKey(),
  participant1Id: varchar("participant1_id").notNull().references(() => users.id),
  participant2Id: varchar("participant2_id").notNull().references(() => users.id),
  subject: text("subject"),
  lastMessageAt: timestamp("last_message_at").defaultNow(),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DirectConversation = typeof directConversations.$inferSelect;
export type InsertDirectConversation = typeof directConversations.$inferInsert;

export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  conversationId: integer("conversation_id").notNull().references(() => directConversations.id),
  senderId: varchar("sender_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  readAt: timestamp("read_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type DirectMessage = typeof directMessages.$inferSelect;
export type InsertDirectMessage = typeof directMessages.$inferInsert;
