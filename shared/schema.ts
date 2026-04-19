export * from "./models/auth";
import { pgTable, text, serial, integer, boolean, timestamp, varchar, uniqueIndex, jsonb } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
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
  city: text("city").default("Moyock"),
  state: text("state").default("NC"),
  zipCode: text("zip_code").default("27958"),
  category: text("category").notNull(), // 'Food', 'Retail', 'Service', 'Entertainment'
  imageUrl: text("image_url").notNull(),
  verified: boolean("verified").default(false),
  
  // Business credentials - helps customers identify legitimate businesses
  hasLLC: boolean("has_llc").default(false),
  hasInsurance: boolean("has_insurance").default(false),
  isLicensed: boolean("is_licensed").default(false),
  establishedYear: integer("established_year"),
  establishedZipCode: text("established_zip_code"),
  servicesCommercial: boolean("services_commercial").default(false),
  servicesResidential: boolean("services_residential").default(false),
  
  isVeteran: boolean("is_veteran").default(false),
  ownerName: text("owner_name"),
  businessHours: text("business_hours"), // JSON string of hours per day
  socialMediaUrls: text("social_media_urls"), // JSON string of social media links
  searchKeywords: text("search_keywords"), // Comma-separated keywords for search, max 250 chars
  localOperationDescription: text("local_operation_description"),
  additionalCategories: text("additional_categories").array().default([]),
  
  // Local 365 Partner Program - perks businesses offer to elite members
  isLocal365Partner: boolean("is_local365_partner").default(false),
  silverPerk: text("silver_perk"),
  goldPerk: text("gold_perk"),
  platinumPerk: text("platinum_perk"),
  ambassadorPerk: text("ambassador_perk"),
  
  // Business Membership Tiers
  membershipTier: text("membership_tier").default("none"), // 'none', 'basic'(Bronze), 'standard'(Silver), 'premium'(Gold)
  membershipPaymentFrequency: text("membership_payment_frequency"),
  membershipStartDate: timestamp("membership_start_date"),
  membershipEndDate: timestamp("membership_end_date"),
  membershipTrialUsed: boolean("membership_trial_used").default(false),
  goldTrialEndDate: timestamp("gold_trial_end_date"),
  originalMembershipTier: text("original_membership_tier"),
  // Referral & Founding-Member program (added 2026-04)
  referralCode: text("referral_code").unique(),
  referredByCode: text("referred_by_code"),
  isFoundingMember: boolean("is_founding_member").default(false),
  foundingMemberNumber: integer("founding_member_number").unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  phone: text("phone"),
  email: text("email"),
  websiteUrl: text("website_url"),
  logoUrl: text("logo_url"),
  galleryPhotos: text("gallery_photos").array().default([]),
  promoVideoUrl: text("promo_video_url"),
  acceptsQuotes: boolean("accepts_quotes").default(true),
  isExample: boolean("is_example").default(false),
  createdAt: timestamp("created_at").defaultNow(),
});

export const businessVerificationChecks = pgTable("business_verification_checks", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  checkType: text("check_type").notNull(),
  status: text("status").default("pending"),
  result: text("result"),
  details: text("details"),
  rawResponse: text("raw_response"),
  checkedAt: timestamp("checked_at").defaultNow(),
});

export type BusinessVerificationCheck = typeof businessVerificationChecks.$inferSelect;

export const verificationDocuments = pgTable("verification_documents", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  documentType: text("document_type").notNull(),
  fileName: text("file_name").notNull(),
  fileUrl: text("file_url").notNull(),
  status: text("status").default("pending"),
  adminNote: text("admin_note"),
  uploadedAt: timestamp("uploaded_at").defaultNow(),
  reviewedAt: timestamp("reviewed_at"),
});

export type VerificationDocument = typeof verificationDocuments.$inferSelect;

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
  eventDates: text("event_dates").array().default([]),
  location: text("location").notNull(),
  city: text("city").default("Moyock"),
  state: text("state").default("NC"),
  zipCode: text("zip_code").default("27958"),
  imageUrl: text("image_url"),
  flyerUrl: text("flyer_url"),
  promoVideoUrl: text("promo_video_url"),
  adSize: text("ad_size").default("small"),
  adDuration: text("ad_duration").default("2week"),
  displayStartDate: timestamp("display_start_date"),
  businessId: integer("business_id").references(() => businesses.id),
  targetZipCodes: text("target_zip_codes").array().default([]),
  status: text("status").default("pending"),
  adminNote: text("admin_note"),
  isExample: boolean("is_example").default(false),
  paymentStatus: text("payment_status").default("unpaid"),
  priceCharged: integer("price_charged"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  content: text("content").notNull(),
  imageUrl: text("image_url"),
  authorId: varchar("author_id").notNull().references(() => users.id),
  likes: integer("likes").default(0),
  commentCount: integer("comment_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Comments on posts - only verified members can comment
export const comments = pgTable("comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => posts.id),
  authorId: varchar("author_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  likes: integer("likes").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const reviews = pgTable("reviews", {
  id: serial("id").primaryKey(),
  rating: integer("rating").notNull(),
  comment: text("comment").notNull(),
  receiptUrl: text("receipt_url"),
  userId: varchar("user_id").notNull().references(() => users.id),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  ownerResponse: text("owner_response"),
  ownerResponseDate: timestamp("owner_response_date"),
  verificationStatus: varchar("verification_status").default("unverified"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const jobListings = pgTable("job_listings", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  contactPhone: text("contact_phone"),
  contactEmail: text("contact_email"),
  isActive: boolean("is_active").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  paidThroughDate: timestamp("paid_through_date"),
  stripeSubscriptionId: text("stripe_subscription_id"),
});

// Relations
export const businessesRelations = relations(businesses, ({ many }) => ({
  events: many(events),
  reviews: many(reviews),
  jobListings: many(jobListings),
}));

export const eventsRelations = relations(events, ({ one }) => ({
  business: one(businesses, {
    fields: [events.businessId],
    references: [businesses.id],
  }),
}));

export const postsRelations = relations(posts, ({ one, many }) => ({
  author: one(users, {
    fields: [posts.authorId],
    references: [users.id],
  }),
  comments: many(comments),
}));

export const commentsRelations = relations(comments, ({ one }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  author: one(users, {
    fields: [comments.authorId],
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

export const jobListingsRelations = relations(jobListings, ({ one }) => ({
  business: one(businesses, {
    fields: [jobListings.businessId],
    references: [businesses.id],
  }),
}));

// Advertising system - businesses can purchase ad placements
export const adPlacements = pgTable("ad_placements", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").references(() => businesses.id).notNull(),
  placementType: text("placement_type").notNull(),
  adSize: text("ad_size").default("small"),
  title: text("title").notNull(),
  description: text("description"),
  imageUrl: text("image_url"),
  videoUrl: text("video_url"),
  linkUrl: text("link_url"),
  category: text("category"),
  status: text("status").default("pending"),
  startDate: timestamp("start_date"),
  endDate: timestamp("end_date"),
  pricePerWeek: integer("price_per_week"),
  priceMonthly: integer("price_monthly"),
  totalPaid: integer("total_paid").default(0),
  paymentStatus: text("payment_status").default("unpaid"),
  paymentNotes: text("payment_notes"),
  impressions: integer("impressions").default(0),
  clicks: integer("clicks").default(0),
  targetZipCodes: text("target_zip_codes").array().default([]),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Ad pricing tiers (admin-configurable)
export const adPricing = pgTable("ad_pricing", {
  id: serial("id").primaryKey(),
  placementType: text("placement_type").notNull().unique(),
  displayName: text("display_name").notNull(),
  description: text("description"),
  pricePerWeek: integer("price_per_week").notNull(), // Price in cents
  maxActive: integer("max_active").default(1), // Max concurrent ads of this type
  isActive: boolean("is_active").default(true),
});

export const categoryRequests = pgTable("category_requests", {
  id: serial("id").primaryKey(),
  categoryName: text("category_name").notNull(),
  description: text("description"),
  submitterName: text("submitter_name"),
  submitterEmail: text("submitter_email"),
  status: text("status").default("pending"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const promoCodes = pgTable("promo_codes", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  description: text("description"),
  // discountType: 'percentage' | 'fixed' | 'gold_access' | 'ai_credits'
  // When 'ai_credits', `aiCreditAmount` is the number of credits granted on
  // redemption and the code can be redeemed by ANY tier (lets us hand codes
  // to non-Gold testers).
  discountType: text("discount_type").notNull().default("percentage"),
  discountValue: integer("discount_value").notNull(),
  aiCreditAmount: integer("ai_credit_amount"), // only used when discountType='ai_credits'
  applicableTiers: text("applicable_tiers").array().default([]),
  maxUses: integer("max_uses"),
  currentUses: integer("current_uses").default(0),
  startsAt: timestamp("starts_at"),
  expiresAt: timestamp("expires_at"),
  isActive: boolean("is_active").default(true),
  durationDays: integer("duration_days"),
  createdAt: timestamp("created_at").defaultNow(),
});

// Refer-a-Business growth program. A new business may set
// `referredByCode` at signup; once they activate any paid membership,
// processMembershipActivation() finds the matching pending row, flips
// it to 'rewarded', and extends both businesses' goldTrialEndDate by
// 30 days. Unique on referredBusinessId so a business can only ever be
// the recipient of one referral.
export const referrals = pgTable("referrals", {
  id: serial("id").primaryKey(),
  referrerBusinessId: integer("referrer_business_id").notNull().references(() => businesses.id),
  referredBusinessId: integer("referred_business_id").notNull().unique().references(() => businesses.id),
  code: text("code").notNull(),
  status: text("status").notNull().default("pending"), // 'pending' | 'rewarded'
  rewardDays: integer("reward_days").notNull().default(30),
  createdAt: timestamp("created_at").defaultNow(),
  rewardedAt: timestamp("rewarded_at"),
});

export const promoCodeUsages = pgTable("promo_code_usages", {
  id: serial("id").primaryKey(),
  promoCodeId: integer("promo_code_id").notNull().references(() => promoCodes.id),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  appliedAt: timestamp("applied_at").defaultNow(),
  stripeSessionId: text("stripe_session_id"),
});

export const membershipDowngrades = pgTable("membership_downgrades", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  previousTier: text("previous_tier").notNull(),
  newTier: text("new_tier").notNull(),
  downgradedAt: timestamp("downgraded_at").defaultNow(),
  winBackEligibleAt: timestamp("win_back_eligible_at"),
  winBackSent: boolean("win_back_sent").default(false),
  winBackConvertedAt: timestamp("win_back_converted_at"),
});

export const businessAnalytics = pgTable("business_analytics", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id),
  eventType: text("event_type").notNull(),
  eventDate: timestamp("event_date").defaultNow(),
});

// Schemas & Types
export const insertCategorySchema = createInsertSchema(categories).omit({ id: true });
export const insertBusinessSchema = createInsertSchema(businesses).omit({ id: true, verified: true });
export const insertEventSchema = createInsertSchema(events).omit({ id: true, status: true, adminNote: true, paymentStatus: true, priceCharged: true, createdAt: true }).refine(
  (data) => {
    if (data.flyerUrl && !/^https?:\/\//i.test(data.flyerUrl)) {
      return false;
    }
    return true;
  },
  { message: "Flyer URL must start with http:// or https://", path: ["flyerUrl"] }
);
export const insertPostSchema = createInsertSchema(posts).omit({ id: true, createdAt: true, authorId: true, likes: true, commentCount: true }); 
export const insertReviewSchema = createInsertSchema(reviews).omit({ id: true, createdAt: true, userId: true, businessId: true });
export const insertCommentSchema = createInsertSchema(comments).omit({ id: true, createdAt: true, authorId: true, likes: true });
export const insertLocationSchema = createInsertSchema(locations).omit({ id: true });
export const insertAdPlacementSchema = createInsertSchema(adPlacements).omit({ 
  id: true, 
  status: true, 
  impressions: true, 
  clicks: true, 
  createdAt: true, 
  updatedAt: true,
  paymentStatus: true,
  paymentNotes: true,
  totalPaid: true
});
export const insertAdPricingSchema = createInsertSchema(adPricing).omit({ id: true });
export const insertCategoryRequestSchema = createInsertSchema(categoryRequests).omit({ id: true, status: true, createdAt: true });
export const insertPromoCodeSchema = createInsertSchema(promoCodes).omit({ id: true, currentUses: true, createdAt: true });
export const insertMembershipDowngradeSchema = createInsertSchema(membershipDowngrades).omit({ id: true, downgradedAt: true, winBackSent: true, winBackConvertedAt: true });
export const insertJobListingSchema = createInsertSchema(jobListings).omit({ id: true, createdAt: true, isActive: true, paidThroughDate: true, stripeSubscriptionId: true });

export type Category = typeof categories.$inferSelect;
export type Business = typeof businesses.$inferSelect;
export type Event = typeof events.$inferSelect;
export type Post = typeof posts.$inferSelect;
export type Comment = typeof comments.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Location = typeof locations.$inferSelect;
export type AdPlacement = typeof adPlacements.$inferSelect;
export type AdPricing = typeof adPricing.$inferSelect;
export type InsertLocation = z.infer<typeof insertLocationSchema>;
export type InsertAdPlacement = z.infer<typeof insertAdPlacementSchema>;
export type InsertAdPricing = z.infer<typeof insertAdPricingSchema>;
export type CategoryRequest = typeof categoryRequests.$inferSelect;
export type InsertCategoryRequest = z.infer<typeof insertCategoryRequestSchema>;
export type PromoCode = typeof promoCodes.$inferSelect;
export type InsertPromoCode = z.infer<typeof insertPromoCodeSchema>;
export type PromoCodeUsage = typeof promoCodeUsages.$inferSelect;
export type MembershipDowngrade = typeof membershipDowngrades.$inferSelect;
export type InsertMembershipDowngrade = z.infer<typeof insertMembershipDowngradeSchema>;
export type JobListing = typeof jobListings.$inferSelect;
export type InsertJobListing = z.infer<typeof insertJobListingSchema>;
export type JobListingWithBusiness = JobListing & { business: Business | null };
export type BusinessAnalytic = typeof businessAnalytics.$inferSelect;

export type CreateBusinessRequest = z.infer<typeof insertBusinessSchema>;
export type CreateEventRequest = z.infer<typeof insertEventSchema>;
export type CreatePostRequest = z.infer<typeof insertPostSchema>;
export type CreateReviewRequest = z.infer<typeof insertReviewSchema>;

export const adminSubmissions = pgTable("admin_submissions", {
  id: serial("id").primaryKey(),
  userId: text("user_id").references(() => users.id),
  name: text("name").notNull(),
  email: text("email").notNull(),
  subject: text("subject").notNull(),
  message: text("message").notNull(),
  status: text("status").default("pending"),
  adminNote: text("admin_note"),
  createdAt: timestamp("created_at").defaultNow(),
  resolvedAt: timestamp("resolved_at"),
});

export const insertAdminSubmissionSchema = createInsertSchema(adminSubmissions).omit({
  id: true,
  status: true,
  adminNote: true,
  createdAt: true,
  resolvedAt: true,
});
export type AdminSubmission = typeof adminSubmissions.$inferSelect;
export type InsertAdminSubmission = z.infer<typeof insertAdminSubmissionSchema>;

// Complex response types
export type EventWithTier = Event & { businessMembershipTier?: string | null };
export type BusinessWithRating = Business & { averageRating: number; reviewCount: number };
export type PostWithAuthor = Post & { author: typeof users.$inferSelect | null; comments?: CommentWithAuthor[] };
export type CommentWithAuthor = Comment & { author: typeof users.$inferSelect | null };
export type ReviewWithUser = Review & { user: typeof users.$inferSelect };
export type CreateCommentRequest = z.infer<typeof insertCommentSchema>;

// Re-export chat models for AI chat feature
export { conversations, messages, insertConversationSchema, insertMessageSchema } from "./models/chat";
export type { Conversation, Message, InsertConversation, InsertMessage } from "./models/chat";

/* ────────────────────────────────────────────────────────────────────────
   Newsletter — Marketing Suite Feature #1
   Replaces Mailchimp/Constant Contact for Gold business owners. Subscriber
   list auto-builds from past quote requesters & reviewers, plus manual adds.
   Sends via Resend with CAN-SPAM-compliant unsubscribe link in every email.
   ──────────────────────────────────────────────────────────────────────── */

export const newsletterSubscribers = pgTable("newsletter_subscribers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  userId: varchar("user_id").references(() => users.id),
  email: text("email").notNull(),
  name: text("name"),
  // 'quote_request' | 'review' | 'manual' | 'import'
  source: text("source").notNull().default("manual"),
  optedInAt: timestamp("opted_in_at").defaultNow(),
  unsubscribedAt: timestamp("unsubscribed_at"),
  unsubscribeToken: text("unsubscribe_token").notNull().unique(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  uniqueIndex("newsletter_sub_business_email_idx").on(t.businessId, t.email),
]);

export const newsletterCampaigns = pgTable("newsletter_campaigns", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  subject: text("subject").notNull(),
  bodyHtml: text("body_html").notNull(),
  // 'draft' | 'sending' | 'sent' | 'failed'
  status: text("status").notNull().default("draft"),
  recipientCount: integer("recipient_count").default(0),
  successCount: integer("success_count").default(0),
  failureCount: integer("failure_count").default(0),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const newsletterSends = pgTable("newsletter_sends", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => newsletterCampaigns.id, { onDelete: "cascade" }),
  subscriberId: integer("subscriber_id").notNull().references(() => newsletterSubscribers.id, { onDelete: "cascade" }),
  // 'queued' | 'sent' | 'failed'
  status: text("status").notNull().default("queued"),
  errorMessage: text("error_message"),
  sentAt: timestamp("sent_at"),
}, (t) => [
  uniqueIndex("newsletter_send_campaign_sub_idx").on(t.campaignId, t.subscriberId),
]);

export type NewsletterSubscriber = typeof newsletterSubscribers.$inferSelect;
export type NewsletterCampaign = typeof newsletterCampaigns.$inferSelect;
export type NewsletterSend = typeof newsletterSends.$inferSelect;

/* ────────────────────────────────────────────────────────────────────────
   Marketing Suite #2: Social Composer
   Generates copy-paste-ready posts for Facebook / Instagram / Google
   Business Profile / Nextdoor from one piece of owner notes. Drafts are
   persisted so the owner can come back later. We do NOT auto-post — that
   requires Meta/Google business app review and is a future feature.
   ──────────────────────────────────────────────────────────────────────── */

export const socialDrafts = pgTable("social_drafts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  sourceNotes: text("source_notes").notNull(),
  imageUrl: text("image_url"),
  // jsonb: { facebook?: string, instagram?: string, googleBusiness?: string, nextdoor?: string }
  variants: jsonb("variants").notNull().default(sql`'{}'::jsonb`),
  // 'draft' | 'posted' (owner self-marks after pasting)
  status: text("status").notNull().default("draft"),
  scheduledFor: timestamp("scheduled_for"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type SocialDraft = typeof socialDrafts.$inferSelect;

/* ────────────────────────────────────────────────────────────────────────
   AI Lab — Phase 1A: Credit System
   These tables are isolated to the AI Suite. Nothing in the rest of the
   platform reads from or writes to them yet. They are populated and
   exercised exclusively from the admin AI Lab page until graduated.
   ──────────────────────────────────────────────────────────────────────── */

// Credit packs sold to Gold members (one-time Stripe purchases)
export const aiCreditPacks = pgTable("ai_credit_packs", {
  id: serial("id").primaryKey(),
  sku: text("sku").notNull().unique(), // e.g. "starter", "popular", "power", "pro"
  name: text("name").notNull(), // display name e.g. "1,500 credits"
  credits: integer("credits").notNull(),
  priceCents: integer("price_cents").notNull(),
  stripePriceId: text("stripe_price_id"), // wired in Phase 1B
  isActive: boolean("is_active").default(true),
  sortOrder: integer("sort_order").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

// Per-business credit balance + monthly allowance settings
export const aiCredits = pgTable("ai_credits", {
  businessId: integer("business_id").primaryKey().references(() => businesses.id, { onDelete: "cascade" }),
  balance: integer("balance").notNull().default(0),
  monthlyAllowance: integer("monthly_allowance").notNull().default(250), // bonus credits granted to Gold
  monthlyAdsIncluded: integer("monthly_ads_included").notNull().default(1),
  monthlyReelsIncluded: integer("monthly_reels_included").notNull().default(1),
  monthlyEnhancementsIncluded: integer("monthly_enhancements_included").notNull().default(25),
  adsUsedThisCycle: integer("ads_used_this_cycle").notNull().default(0),
  reelsUsedThisCycle: integer("reels_used_this_cycle").notNull().default(0),
  enhancementsUsedThisCycle: integer("enhancements_used_this_cycle").notNull().default(0),
  cycleResetsAt: timestamp("cycle_resets_at"), // next monthly grant
  lastGrantAt: timestamp("last_grant_at"),
  autoReloadEnabled: boolean("auto_reload_enabled").default(false),
  autoReloadPackSku: text("auto_reload_pack_sku"),
  isFounderComp: boolean("is_founder_comp").default(false), // bypasses charges, costs still tracked
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Every credit movement: grants, purchases, usage, refunds, founder-comps
export const aiCreditTransactions = pgTable("ai_credit_transactions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  // type: monthly_grant | founder_grant | purchase | usage | refund | admin_adjust
  type: text("type").notNull(),
  // for usage rows: which feature was used
  // text_generation | ad_image | ad_image_included | reel | reel_included
  // photo_enhance | photo_enhance_included | listing_coach | review_insights | competitor_intel
  feature: text("feature"),
  // signed credit delta (+grant / -usage)
  creditsDelta: integer("credits_delta").notNull().default(0),
  // your actual API spend in cents (positive cost; only set on usage rows)
  costCents: integer("cost_cents").notNull().default(0),
  // revenue collected in cents (only set on purchase rows)
  revenueCents: integer("revenue_cents").notNull().default(0),
  // free-form notes / payload (e.g. Stripe payment intent id, prompt summary)
  metadata: text("metadata"), // JSON string
  // Idempotency keys:
  // - grantPeriod: "YYYY-MM" for monthly_grant/founder_grant rows; ensures one grant per business per cycle
  // - stripePaymentIntentId: unique per Stripe charge so duplicate webhooks cannot double-credit
  grantPeriod: text("grant_period"),
  stripePaymentIntentId: text("stripe_payment_intent_id").unique(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => ({
  // Exactly-once grants per (business, type, period) — partial-style index works in Postgres
  uniqGrantPerPeriod: uniqueIndex("ai_credit_txn_unique_grant_per_period")
    .on(t.businessId, t.type, t.grantPeriod),
}));

export const insertAiCreditPackSchema = createInsertSchema(aiCreditPacks).omit({ id: true, createdAt: true });
export type AiCreditPack = typeof aiCreditPacks.$inferSelect;
export type InsertAiCreditPack = z.infer<typeof insertAiCreditPackSchema>;
export type AiCredits = typeof aiCredits.$inferSelect;
export type AiCreditTransaction = typeof aiCreditTransactions.$inferSelect;
