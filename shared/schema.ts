export * from "./models/auth";
import { pgTable, text, serial, integer, boolean, timestamp, varchar, uniqueIndex, index, jsonb } from "drizzle-orm/pg-core";
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
  // Comp memberships: when true, the business has Gold-equivalent access
  // regardless of `membershipTier` or any Stripe subscription state.
  // Set/cleared exclusively by the admin comp-membership endpoint;
  // never written from public/business edit paths. Honored by every
  // Gold gate via the per-feature `effectiveTier()` helper.
  isCompedMembership: boolean("is_comped_membership").default(false),
  compedMembershipNote: text("comped_membership_note"),
  compedMembershipGrantedAt: timestamp("comped_membership_granted_at"),
  compedMembershipGrantedBy: varchar("comped_membership_granted_by"),
  // Optional auto-expiry for comp grants. NULL = indefinite. Once the
  // current time passes this value, every effectiveTier() helper treats
  // the business as if it were not comped (falls back to its real tier).
  compedMembershipExpiresAt: timestamp("comped_membership_expires_at"),
  // Tracks which auto-expiry warning emails have already been sent for the
  // CURRENT `compedMembershipExpiresAt` window. Reset to false whenever a
  // new comp grant is issued (or expiry date changes) so re-grants get a
  // fresh round of warnings. Cleared on revoke alongside the other comp
  // fields so a future grant starts clean.
  compedMembershipReminder7Sent: boolean("comped_membership_reminder_7_sent").default(false),
  compedMembershipReminder1Sent: boolean("comped_membership_reminder_1_sent").default(false),
  // Timestamp of the most recent successful comp welcome email send for this
  // business — set on initial grant and on every successful "resend welcome"
  // from the admin panel. Cleared on revoke alongside the other comp fields
  // so a future grant starts clean. Powers the "last welcome sent" column +
  // cooldown countdown in the admin Comp Memberships panel.
  compedWelcomeEmailSentAt: timestamp("comped_welcome_email_sent_at"),
  foundingMemberNumber: integer("founding_member_number").unique(),
  // Last known Stripe customer-balance credit (cents, positive number) for
  // this business, persisted so the owner dashboard can keep showing the
  // real pending-credit dollar value across server restarts and Stripe
  // outages instead of flashing a misleading $0. Refreshed whenever we
  // successfully read the Stripe balance, when we issue a referral credit,
  // and when an invoice consumes a credit. NULL means we've never read it
  // (treat as unknown — UI falls back to its tier-based estimate).
  lastKnownPendingCreditCents: integer("last_known_pending_credit_cents"),
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
  // Multi-zip listings (Task #13) — owner can publish in multiple zips.
  // Each zip = a separate businesses row. ownerUserId is the canonical
  // owner pointer (back-fills from users.linkedBusinessId on push).
  ownerUserId: varchar("owner_user_id"),
  parentBusinessId: integer("parent_business_id"), // null for primary, set for additional-zip dups
  isAdditionalZip: boolean("is_additional_zip").default(false), // skips Gold trial logic
  status: text("status").default("active"), // 'active' | 'archived'
  // Per-business overrides for the owner-facing webhook bounce-spike heads-up
  // job (`checkBounceSpikeAlerts`). NULL = use the global env defaults
  // (BOUNCE_SPIKE_THRESHOLD / BOUNCE_SPIKE_COOLDOWN_HOURS). A high-volume
  // Gold business may want a higher floor (e.g. 25) and a slower cadence
  // (e.g. weekly = 168h); a small business may want to hear about even 1
  // bounce. `bounceSpikeMuted = true` fully silences the email — the owner
  // still sees the in-app "Recently auto-suppressed" panel.
  bounceSpikeThreshold: integer("bounce_spike_threshold"),
  bounceSpikeCadenceHours: integer("bounce_spike_cadence_hours"),
  bounceSpikeMuted: boolean("bounce_spike_muted").default(false),
  // Timestamp of the most recent owner-triggered "Send test alert" send for
  // this listing. Persisted (instead of an in-memory map) so the cooldown
  // status survives process restarts and can be surfaced inline in the
  // Bounce alerts card without a 429-then-toast round trip.
  bounceSpikeTestLastSentAt: timestamp("bounce_spike_test_last_sent_at"),
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
  name: text("name").notNull(), // Display name e.g., "Kitty Hawk, NC"
  city: text("city").notNull(),
  state: text("state").notNull(),
  zipCodes: text("zip_codes").array().default([]), // Array of zip codes in this location (typically one per row in the per-zip seed)
  region: text("region"), // e.g., "Outer Banks", "Hampton Roads"
  heroImage: text("hero_image"),
  tagline: text("tagline"),
  isActive: boolean("is_active").default(true),
  // Geo + slug fields added for the multi-zip rollout (Task #11). `latitude`/
  // `longitude` are stored as text so the existing pg driver doesn't fight
  // numeric precision; we parse to number on read.
  latitude: text("latitude"),
  longitude: text("longitude"),
  slug: text("slug").unique(),
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

// Durable audit trail for admin comp-membership grants and revocations.
// One row per action (grant OR revoke), append-only — revoking a comp does
// NOT delete the grant rows so the historical "who/when/why" is preserved
// even after `businesses.compedMembership*` columns get cleared.
export const compMembershipAudit = pgTable("comp_membership_audit", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull(),
  action: text("action").notNull(), // 'grant' | 'revoke'
  actorUserId: varchar("actor_user_id"),
  note: text("note"),
  expiresAt: timestamp("expires_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export type CompMembershipAuditEntry = typeof compMembershipAudit.$inferSelect;

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
  // 'pending'    — linked at signup, awaiting referee's first paid invoice
  // 'processing' — webhook is currently issuing the Stripe credit (interim
  //                lock; rolled back to 'pending' on failure or by
  //                requeueStuckProcessingReferrals() at app boot if a crash
  //                left it stranded)
  // 'rewarded'   — credit applied to referrer; reward email sent
  status: text("status").notNull().default("pending"),
  rewardDays: integer("reward_days").notNull().default(30),
  // Actual Stripe credit amount (in cents) issued to the referrer when the
  // row was finalized. Null on legacy rows from before this column existed
  // and on rows that haven't been rewarded yet — UI falls back to a
  // tier-based estimate in that case.
  creditAmountCents: integer("credit_amount_cents"),
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
  // Full unique index (no .where(...) predicate) — both columns are NOT NULL,
  // so a `WHERE … IS NOT NULL` partial predicate would be a no-op. Verified
  // against pg_indexes: this index has no WHERE clause in the live DB. See
  // replit.md → "Partial unique indexes" before adding a predicate here.
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
  // Resend's response.data.id — the join key for the email.opened /
  // email.clicked webhook events. NULL for sends made before this column
  // existed (engagement webhooks for those rows are silently dropped) and
  // for any send where Resend didn't return an id.
  messageId: text("message_id"),
  // Engagement timestamps stamped by the Resend webhook. First-touch
  // semantics — never overwritten on subsequent events.
  openedAt: timestamp("opened_at"),
  clickedAt: timestamp("clicked_at"),
}, (t) => [
  // Full unique index (no .where(...) predicate) — both columns are NOT NULL,
  // so a `WHERE … IS NOT NULL` partial predicate would be a no-op. Verified
  // against pg_indexes: this index has no WHERE clause in the live DB. See
  // replit.md → "Partial unique indexes" before adding a predicate here.
  uniqueIndex("newsletter_send_campaign_sub_idx").on(t.campaignId, t.subscriberId),
  // Webhook lookup is `WHERE message_id = ?`; index speeds that up at
  // scale. NOT unique because a NULL message_id is legal for legacy rows.
  index("newsletter_send_message_id_idx").on(t.messageId),
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
   Marketing Suite #3: SMS Broadcast (Gold-only, charged in AI credits)
   2 credits per SMS segment (160 chars GSM-7). Reuses the AI credit
   system so owners top up via the same Stripe packs.

   TCPA: every subscriber must have an explicit opt-in event. We do NOT
   auto-backfill from quote_requests/reviews like the newsletter does —
   SMS opt-in must be affirmative (a checkbox on the quote form, or
   manual entry by the owner with a consent attestation).
   ──────────────────────────────────────────────────────────────────────── */

export const smsSubscribers = pgTable("sms_subscribers", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  // E.164: +15551234567
  phone: text("phone").notNull(),
  name: text("name"),
  // 'manual' | 'quote_form_optin' | 'review_form_optin' | 'import'
  source: text("source").notNull().default("manual"),
  optedInAt: timestamp("opted_in_at").defaultNow(),
  // STOP/UNSUBSCRIBE keyword received → set this and skip sends
  optedOutAt: timestamp("opted_out_at"),
  optOutKeyword: text("opt_out_keyword"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  // Full unique index (no .where(...) predicate) — both columns are NOT NULL,
  // so a `WHERE … IS NOT NULL` partial predicate would be a no-op. Verified
  // against pg_indexes: this index has no WHERE clause in the live DB. See
  // replit.md → "Partial unique indexes" before adding a predicate here.
  uniqueIndex("sms_sub_business_phone_idx").on(t.businessId, t.phone),
]);

export const smsCampaigns = pgTable("sms_campaigns", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  body: text("body").notNull(),
  // segments per message at send-time (160 chars GSM-7 = 1)
  segmentsPerRecipient: integer("segments_per_recipient").notNull().default(1),
  // 'draft' | 'sending' | 'sent' | 'failed'
  status: text("status").notNull().default("draft"),
  recipientCount: integer("recipient_count").notNull().default(0),
  successCount: integer("success_count").notNull().default(0),
  failureCount: integer("failure_count").notNull().default(0),
  creditsCharged: integer("credits_charged").notNull().default(0),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const smsSends = pgTable("sms_sends", {
  id: serial("id").primaryKey(),
  campaignId: integer("campaign_id").notNull().references(() => smsCampaigns.id, { onDelete: "cascade" }),
  subscriberId: integer("subscriber_id").notNull().references(() => smsSubscribers.id, { onDelete: "cascade" }),
  // 'pending' | 'sent' | 'delivered' | 'failed' | 'skipped_optout'
  status: text("status").notNull().default("pending"),
  // Twilio Message SID for delivery callbacks; null in stub mode
  providerMessageSid: text("provider_message_sid"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  segments: integer("segments").notNull().default(1),
  creditsCharged: integer("credits_charged").notNull().default(0),
  sentAt: timestamp("sent_at"),
}, (t) => [
  // Full unique index (no .where(...) predicate) — both columns are NOT NULL,
  // so a `WHERE … IS NOT NULL` partial predicate would be a no-op. Verified
  // against pg_indexes: this index has no WHERE clause in the live DB. See
  // replit.md → "Partial unique indexes" before adding a predicate here.
  uniqueIndex("sms_send_campaign_sub_idx").on(t.campaignId, t.subscriberId),
]);

export type SmsSubscriber = typeof smsSubscribers.$inferSelect;
export type SmsCampaign = typeof smsCampaigns.$inferSelect;
export type SmsSend = typeof smsSends.$inferSelect;

/* ────────────────────────────────────────────────────────────────────────
   Marketing Suite #4: Daily Deals / Limited-Time Offers (Gold-only)
   Time-bound public offers shown on /deals and on the business listing.
   No cron — "active" is computed at query time as
     status='active' AND startsAt <= now() AND endsAt > now()
   Click counter tracks redemption interest for owner analytics.
   ──────────────────────────────────────────────────────────────────────── */

export const deals = pgTable("deals", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description").notNull(),
  // free-form so owner can write "20% off" or "BOGO" or "$5 off any service"
  discountText: text("discount_text").notNull(),
  redemptionInstructions: text("redemption_instructions").notNull(),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at").notNull(),
  // 'active' | 'paused' | 'archived' (soft delete)
  status: text("status").notNull().default("active"),
  clickCount: integer("click_count").notNull().default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type Deal = typeof deals.$inferSelect;

/* ────────────────────────────────────────────────────────────────────────
   Marketing Suite #5 — Review Request Blasts (Gold-only, 3 credits per AI draft)
   Owner picks past customers (quote requesters or reviewers) and sends a
   personalized "please leave us a review" via email and/or SMS, with a
   click-tracked one-click link to the review form.
   90-day per-customer cap is enforced at SEND time by querying this table.
   ──────────────────────────────────────────────────────────────────────── */

export const reviewRequests = pgTable("review_requests", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  // Recipient identity (one of email/phone is required at send-time)
  recipientUserId: varchar("recipient_user_id"),
  recipientEmail: text("recipient_email"),
  recipientPhone: text("recipient_phone"),
  recipientName: text("recipient_name"),
  // 'email' | 'sms' | 'both'
  channel: text("channel").notNull(),
  // 'queued' | 'sent' | 'failed' | 'clicked' | 'completed'
  status: text("status").notNull().default("queued"),
  token: text("token").notNull().unique(),
  errorMsg: text("error_msg"),
  sentAt: timestamp("sent_at"),
  clickedAt: timestamp("clicked_at"),
  completedReviewId: integer("completed_review_id"),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  uniqueIndex("review_req_business_sent_idx").on(t.businessId, t.sentAt),
]);

export type ReviewRequest = typeof reviewRequests.$inferSelect;
export type InsertReviewRequest = typeof reviewRequests.$inferInsert;

/* Recipient suppressions — addresses Resend has marked permanently
   undeliverable (hard bounce, on the suppression list, or otherwise
   unsendable). We refuse to retry these until the owner clears the
   suppression after fixing the contact info. Scoped per business so
   one tenant's clear doesn't leak to another. */
export const recipientSuppressions = pgTable("recipient_suppressions", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  contactType: text("contact_type").notNull(), // 'email' | 'phone'
  contact: text("contact").notNull(),
  reason: text("reason").notNull(),
  createdAt: timestamp("created_at").defaultNow(),
}, (t) => [
  uniqueIndex("recipient_supp_unique_idx").on(t.businessId, t.contactType, t.contact),
]);
export type RecipientSuppression = typeof recipientSuppressions.$inferSelect;

/* Per-business audit of bounce-rate spike alerts emailed to admins. Used as
   the cooldown record so the hourly check can re-detect a spike without
   spamming admins — we skip a business whose latest row here is newer than
   the cooldown window. One row per alert, kept for postmortem visibility. */
export const bounceRateAlerts = pgTable("bounce_rate_alerts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  alertedAt: timestamp("alerted_at").notNull().defaultNow(),
  bounceCount: integer("bounce_count").notNull(),
  totalCount: integer("total_count").notNull(),
  // Stored as basis-points (e.g. 1234 = 12.34%) so we can rank/trend without
  // floating point in SQL.
  bounceRateBp: integer("bounce_rate_bp").notNull(),
});
export type BounceRateAlert = typeof bounceRateAlerts.$inferSelect;

/* Per-business audit of "owner heads-up" emails sent when their review-request
   blasts produce a sudden cluster of webhook-confirmed permanent bounces.
   Distinct from `bounce_rate_alerts` (admin-facing, %-based, sender-reputation
   warning). This one is owner-facing, raw-count based, and only fires when N+
   new webhook suppressions land for one business inside the lookback window.
   We persist one row per successful send so the daily cron can detect a fresh
   spike without spamming the owner — a business is skipped if its newest row
   here is younger than the cooldown window. */
export const bounceSpikeAlerts = pgTable("bounce_spike_alerts", {
  id: serial("id").primaryKey(),
  businessId: integer("business_id").notNull().references(() => businesses.id, { onDelete: "cascade" }),
  alertedAt: timestamp("alerted_at").notNull().defaultNow(),
  bounceCount: integer("bounce_count").notNull(),
});
export type BounceSpikeAlert = typeof bounceSpikeAlerts.$inferSelect;

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
  // Exactly-once grants per (business, type, period). Declared as a PARTIAL
  // unique index so that non-grant rows (where grantPeriod is NULL) don't
  // collide with each other. The `.where(...)` must mirror the index in
  // Postgres exactly, otherwise drizzle-kit will see drift and prompt to
  // recreate the index on every push. See replit.md → "Partial unique indexes".
  uniqGrantPerPeriod: uniqueIndex("ai_credit_txn_unique_grant_per_period")
    .on(t.businessId, t.type, t.grantPeriod)
    .where(sql`grant_period IS NOT NULL`),
}));

export const insertAiCreditPackSchema = createInsertSchema(aiCreditPacks).omit({ id: true, createdAt: true });
export type AiCreditPack = typeof aiCreditPacks.$inferSelect;
export type InsertAiCreditPack = z.infer<typeof insertAiCreditPackSchema>;
export type AiCredits = typeof aiCredits.$inferSelect;
export type AiCreditTransaction = typeof aiCreditTransactions.$inferSelect;
