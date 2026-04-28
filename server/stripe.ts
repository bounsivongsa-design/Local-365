import Stripe from "stripe";
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { businesses, promoCodes, promoCodeUsages, membershipDowngrades, jobListings, users, adPlacements, events } from "@shared/schema";
import { notifyAdminNewAd } from "./email";
import { eq, and, sql } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";
import { processMembershipActivation, processReferralOnFirstPaidInvoice } from "./referrals";
import { invalidateStripeCreditCache, refreshPersistedCreditFromStripe } from "./stripeCreditCache";
import { applyCreditPackPurchase } from "./aiFeatures";
import { handleAdditionalZipCheckoutCompleted, handleAdditionalZipSubscriptionDeleted } from "./multiZip";

const FOUNDER_BUSINESSES = ["Goat Locker Printing", "Blackwater Technology Solutions"];
const FOUNDER_EMAILS = [
  "boun.sivongsa@gmail.com",
  "bsivongsa@blackwatertechnologysolutions.com",
  "boun.sivongsa@hotmail.com",
  "goatlockerprinting@gmail.com",
];

function normalizeBusinessName(name: string): string {
  // Strip punctuation FIRST (commas, periods, parens) so "Foo Inc., LLC" and
  // "Foo (LLC.)" both reduce to the same canonical form. Without this the
  // legal-suffix regex stripped "LLC" but left a trailing comma, breaking
  // founder-business matching for any name like "Blackwater Tech, LLC".
  return name
    .toLowerCase()
    .replace(/[,.()]/g, ' ')
    .replace(/\b(llc|inc|corp|ltd|co)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function isFounderBusiness(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = normalizeBusinessName(name);
  return FOUNDER_BUSINESSES.some(fb => normalizeBusinessName(fb) === normalized);
}

/**
 * Unified 3-pronged founder/admin bypass for ALL Stripe checkout endpoints
 * (membership, ad placement, job listing, event ad). Mirrors the same logic
 * used by `shouldBypassChargesForOwner` in server/multiZip.ts so behavior is
 * consistent across every paid surface.
 *
 * Returns true if the caller should skip Stripe entirely:
 *   - any user with accountType === "admin"  (admin override)
 *   - any user whose email is in FOUNDER_EMAILS  (e.g. boun.sivongsa@gmail.com)
 *   - any business whose normalized name matches FOUNDER_BUSINESSES
 *     (handles "LLC"/"Inc"/punctuation suffix variations)
 *
 * Why all three: the founder business name lookup alone was fragile —
 * "Blackwater Tech Solutions" (abbreviated) wouldn't match "Blackwater
 * Technology Solutions" because the normalizer doesn't expand abbreviations.
 * A founder/admin should never be charged real Stripe money even if the
 * business row was saved with an abbreviated/typo'd name.
 */
export function shouldBypassCharges(
  user: { accountType?: string | null; email?: string | null } | null | undefined,
  biz: { name?: string | null } | null | undefined,
): boolean {
  if (user?.accountType === "admin") return true;
  if (isFounderEmail(user?.email)) return true;
  if (isFounderBusiness(biz?.name)) return true;
  return false;
}

/**
 * Process a `customer.subscription.deleted` webhook for a MEMBERSHIP
 * subscription (i.e. not job_listing or additional_zip — those are handled
 * separately by their own helpers). Flips the business off the paid tier,
 * records a `membership_downgrades` row capturing the previous tier and the
 * win-back eligibility window (now + 2 months), and clears the Stripe
 * subscription pointer so a future signup re-attaches cleanly.
 *
 * Resolves the business via metadata.businessId, then by stripeSubscriptionId,
 * then by stripeCustomerId — exported so it can be unit-tested without
 * spinning up the Express webhook endpoint.
 */
export async function handleMembershipSubscriptionDeleted(
  subscription: Stripe.Subscription,
): Promise<{ businessId: number | null; previousTier: string | null }> {
  let businessId = parseInt(subscription.metadata?.businessId || "0");

  if (!businessId) {
    const [biz] = await db.select().from(businesses).where(eq(businesses.stripeSubscriptionId, subscription.id));
    businessId = biz?.id || 0;
  }
  if (!businessId && subscription.customer) {
    const [biz] = await db.select().from(businesses).where(eq(businesses.stripeCustomerId, subscription.customer as string));
    businessId = biz?.id || 0;
  }

  if (!businessId) {
    return { businessId: null, previousTier: null };
  }

  const [currentBiz] = await db.select({ membershipTier: businesses.membershipTier }).from(businesses).where(eq(businesses.id, businessId));
  const oldTier = currentBiz?.membershipTier ?? null;

  if (oldTier && oldTier !== "none") {
    const winBackDate = new Date();
    winBackDate.setMonth(winBackDate.getMonth() + 2);
    await db.insert(membershipDowngrades).values({
      businessId,
      previousTier: oldTier,
      newTier: "none",
      winBackEligibleAt: winBackDate,
    });
  }

  await db.update(businesses).set({
    membershipTier: "none",
    membershipPaymentFrequency: null,
    membershipEndDate: new Date(),
    stripeSubscriptionId: null,
  }).where(eq(businesses.id, businessId));
  console.log(`Membership canceled: business ${businessId}`);
  return { businessId, previousTier: oldTier };
}

function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FOUNDER_EMAILS.some(fe => fe.toLowerCase() === email.toLowerCase());
}

function getEffectiveTier(biz: { membershipTier: string | null; goldTrialEndDate: Date | null; name?: string | null; isCompedMembership?: boolean | null; compedMembershipExpiresAt?: Date | string | null }): string {
  if (biz.name && isFounderBusiness(biz.name)) {
    return "premium";
  }
  if (isCompActive(biz)) {
    return "premium";
  }
  if (biz.goldTrialEndDate && new Date(biz.goldTrialEndDate) > new Date()) {
    return "premium";
  }
  return biz.membershipTier || "none";
}

if (!process.env.Stripeintegration) {
  console.warn("Stripe secret key not configured — payment features disabled");
}

const stripe = process.env.Stripeintegration
  ? new Stripe(process.env.Stripeintegration, { apiVersion: "2025-02-24.acacia" as any })
  : null;

export { stripe };

const TIER_TO_DB: Record<string, string> = {
  bronze: "basic",
  silver: "standard",
  gold: "premium",
};

const DB_TO_TIER: Record<string, string> = {
  basic: "bronze",
  standard: "silver",
  premium: "gold",
};

// Derived from shared/config/membership.ts so there is one source of truth for
// pricing. Stripe uses cents — multiply dollars by 100. Frequency keys use the
// snake_case form ("semi_annual") to match the API contract; the config uses
// "semi-annual".
import { MEMBERSHIP_TIERS, isCompActive } from "@shared/config/membership";

const TIER_PRICES: Record<string, Record<string, number>> = Object.fromEntries(
  MEMBERSHIP_TIERS.map((t) => [
    t.id,
    {
      monthly: Math.round(t.monthlyPrice * 100),
      semi_annual: Math.round(t.semiAnnualPrice * 100),
      annual: Math.round(t.annualPrice * 100),
    },
  ]),
);

const FREQUENCY_INTERVAL: Record<string, { interval: Stripe.Price.Recurring.Interval; interval_count: number }> = {
  monthly: { interval: "month", interval_count: 1 },
  semi_annual: { interval: "month", interval_count: 6 },
  annual: { interval: "year", interval_count: 1 },
};

async function getOrCreateStripeCustomer(businessId: number, email: string, businessName: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId));
  if (biz?.stripeCustomerId) {
    try {
      await stripe.customers.retrieve(biz.stripeCustomerId);
      return biz.stripeCustomerId;
    } catch (err: any) {
      if (err?.statusCode === 404 || err?.code === 'resource_missing') {
        console.log(`Stale Stripe customer ${biz.stripeCustomerId} for business ${businessId}, creating new one`);
      } else {
        throw err;
      }
    }
  }

  const customer = await stripe.customers.create({
    email,
    name: businessName,
    metadata: { businessId: String(businessId) },
  });

  await db.update(businesses).set({ stripeCustomerId: customer.id }).where(eq(businesses.id, businessId));
  return customer.id;
}

export function registerStripeRoutes(app: Express) {
  if (!stripe) {
    app.post("/api/stripe/create-checkout", (req, res) => {
      res.status(503).json({ message: "Payment system not configured" });
    });
    app.post("/api/stripe/create-portal", (req, res) => {
      res.status(503).json({ message: "Payment system not configured" });
    });
    app.get("/api/stripe/subscription-status", (req, res) => {
      res.status(503).json({ message: "Payment system not configured" });
    });
    app.post("/api/stripe/job-checkout", (req, res) => {
      res.status(503).json({ message: "Payment system not configured" });
    });
    app.post("/api/stripe/ad-checkout", (req, res) => {
      res.status(503).json({ message: "Payment system not configured" });
    });
    return;
  }

  app.post("/api/stripe/create-checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const { tier, frequency, promoCode } = req.body;

      if (!tier || !frequency) {
        return res.status(400).json({ message: "Tier and frequency are required" });
      }

      if (!TIER_PRICES[tier] || !TIER_PRICES[tier][frequency]) {
        return res.status(400).json({ message: "Invalid tier or frequency" });
      }

      let biz: any = null;
      if (req.user?.linkedBusinessId) {
        const [found] = await db.select().from(businesses).where(eq(businesses.id, req.user.linkedBusinessId));
        biz = found || null;
      }

      if (shouldBypassCharges(req.user, biz)) {
        if (biz) {
          await db.update(businesses).set({
            membershipTier: "premium",
            membershipStartDate: new Date(),
            membershipEndDate: null,
          }).where(eq(businesses.id, biz.id));
          await processMembershipActivation(biz.id).catch((e) => console.error("[referrals] founder bypass:", e));
        } else {
          await db.update(users).set({
            pendingMembershipTier: "premium",
          }).where(eq(users.id, req.user!.id));
        }
        return res.json({ founderBypass: true, message: "Founder business — Gold membership activated for free!" });
      }

      let promoId: number | null = null;
      let goldTrialDays: number | null = null;
      let promoCouponId: string | null = null;
      let promoIsFullDiscount = false;
      let promoFreeDays: number | null = null;
      if (promoCode) {
        const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, promoCode.toUpperCase())).limit(1);
        if (!promo) {
          return res.status(400).json({ message: "Invalid promo code" });
        }
        if (!promo.isActive) {
          return res.status(400).json({ message: "This promo code is no longer active" });
        }
        const now = new Date();
        if (promo.expiresAt && new Date(promo.expiresAt) < now) {
          return res.status(400).json({ message: "This promo code has expired" });
        }
        if (promo.startsAt && new Date(promo.startsAt) > now) {
          return res.status(400).json({ message: "This promo code is not yet active" });
        }
        if (promo.maxUses && (promo.currentUses || 0) >= promo.maxUses) {
          return res.status(400).json({ message: "This promo code has reached its usage limit" });
        }
        if (promo.discountType !== "gold_trial" && promo.applicableTiers?.length && !promo.applicableTiers.includes(tier)) {
          return res.status(400).json({ message: `This promo code is not applicable to the ${tier} tier` });
        }
        if (biz) {
          const existingUsage = await db.select({ id: promoCodeUsages.id }).from(promoCodeUsages)
            .where(and(eq(promoCodeUsages.promoCodeId, promo.id), eq(promoCodeUsages.businessId, biz.id))).limit(1);
          if (existingUsage.length > 0) {
            return res.status(400).json({ message: "This promo code has already been used by your business" });
          }
        }
        promoId = promo.id;
        if (promo.discountType === "gold_trial") {
          goldTrialDays = promo.durationDays || 30;
        } else if (promo.discountType === "percentage") {
          const pct = promo.discountValue || 0;
          promoIsFullDiscount = pct >= 100;
          if (promoIsFullDiscount && promo.durationDays && promo.durationDays > 0) {
            promoFreeDays = promo.durationDays;
          } else if (!promoIsFullDiscount && pct > 0) {
            const coupon = await stripe.coupons.create({
              percent_off: pct,
              duration: "once",
              name: `Promo: ${promo.code}`,
            });
            promoCouponId = coupon.id;
          }
        } else if (promo.discountType === "fixed_amount") {
          const amt = promo.discountValue || 0;
          if (amt > 0) {
            const coupon = await stripe.coupons.create({
              amount_off: Math.round(amt * 100),
              currency: "usd",
              duration: "once",
              name: `Promo: ${promo.code}`,
            });
            promoCouponId = coupon.id;
          }
        }
      }

      let customerId: string;
      if (biz) {
        customerId = await getOrCreateStripeCustomer(biz.id, req.user.email, biz.name);
      } else {
        const [currentUser] = await db.select().from(users).where(eq(users.id, userId));
        let existingValid = false;
        if (currentUser?.stripeCustomerId) {
          try {
            await stripe.customers.retrieve(currentUser.stripeCustomerId);
            customerId = currentUser.stripeCustomerId;
            existingValid = true;
          } catch (err: any) {
            if (err?.statusCode === 404 || err?.code === 'resource_missing') {
              console.log(`Stale Stripe customer ${currentUser.stripeCustomerId} for user ${userId}, creating new one`);
            } else {
              throw err;
            }
          }
        }
        if (!existingValid) {
          const customer = await stripe.customers.create({
            email: req.user.email,
            name: `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim() || req.user.email,
            metadata: { userId },
          });
          customerId = customer.id;
          await db.update(users).set({ stripeCustomerId: customer.id }).where(eq(users.id, userId));
        }
      }

      const priceAmount = TIER_PRICES[tier][frequency];

      if (promoIsFullDiscount && !promoCouponId) {
        const fullCoupon = await stripe.coupons.create({
          percent_off: 100,
          duration: "once",
          name: `Promo: 100% off`,
        });
        promoCouponId = fullCoupon.id;
      }

      const isNewMember = biz ? !biz.membershipTrialUsed : true;
      const effectiveTier = (tier === "bronze" || tier === "silver") && isNewMember ? "gold" : tier;
      const effectiveDbTier = TIER_TO_DB[effectiveTier];
      const isAutoUpgrade = effectiveTier !== tier;

      const intervalConfig = FREQUENCY_INTERVAL[frequency];
      const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
      const freqLabel = frequency === "monthly" ? "Monthly" : frequency === "semi_annual" ? "Semi-Annual" : "Annual";

      const baseUrl = `https://${req.get("host")}`;

      const successUrl = biz
        ? `${baseUrl}/membership?session_id={CHECKOUT_SESSION_ID}&success=true`
        : `${baseUrl}/create-business?session_id={CHECKOUT_SESSION_ID}&success=true`;

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        mode: "subscription",
        payment_method_collection: "always",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Local List 365 — ${tierName} Membership (${freqLabel})${isAutoUpgrade || goldTrialDays ? ' — Gold Trial' : ''}`,
                description: goldTrialDays
                  ? `Gold tier trial for ${goldTrialDays} days! Then reverts to ${tier.charAt(0).toUpperCase() + tier.slice(1)}.`
                  : isAutoUpgrade
                    ? `Gold tier trial for first 30 days! Then reverts to ${tier.charAt(0).toUpperCase() + tier.slice(1)}.`
                    : `${tierName} tier membership`,
              },
              unit_amount: priceAmount,
              recurring: intervalConfig,
            },
            quantity: 1,
          },
        ],
        success_url: successUrl,
        cancel_url: `${baseUrl}/membership?canceled=true`,
        metadata: {
          businessId: biz ? String(biz.id) : "",
          tier: effectiveDbTier,
          originalTier: TIER_TO_DB[tier],
          isAutoUpgrade: isAutoUpgrade ? "true" : "false",
          frequency,
          userId,
          promoCodeId: promoId ? String(promoId) : "",
        },
      };

      sessionParams.subscription_data = {
        metadata: {
          businessId: biz ? String(biz.id) : "",
          tier: effectiveDbTier,
          originalTier: TIER_TO_DB[tier],
          isAutoUpgrade: isAutoUpgrade ? "true" : "false",
          frequency,
        },
      };

      const baselineTrialDays = goldTrialDays || (isNewMember ? 30 : 0);
      const effectiveTrialDays = Math.max(baselineTrialDays, promoFreeDays || 0);
      if (effectiveTrialDays > 0) {
        sessionParams.subscription_data.trial_period_days = effectiveTrialDays;
      }

      if (promoCouponId) {
        sessionParams.discounts = [{ coupon: promoCouponId }];
      }

      const session = await stripe.checkout.sessions.create(sessionParams);

      res.json({ url: session.url, autoUpgrade: isAutoUpgrade });
    } catch (err: any) {
      console.error("Stripe checkout error:", err);
      res.status(500).json({ message: err.message || "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/create-portal", isAuthenticated, async (req: any, res: Response) => {
    try {
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, req.user?.linkedBusinessId || 0));
      if (!biz?.stripeCustomerId) {
        return res.status(404).json({ message: "No active subscription found" });
      }

      const baseUrl = `https://${req.get("host")}`;

      const session = await stripe.billingPortal.sessions.create({
        customer: biz.stripeCustomerId,
        return_url: `${baseUrl}/membership`,
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Portal session error:", err);
      res.status(500).json({ message: "Failed to create billing portal session" });
    }
  });

  app.get("/api/stripe/subscription-status", isAuthenticated, async (req: any, res: Response) => {
    try {
      const [biz] = await db.select().from(businesses).where(eq(businesses.id, req.user?.linkedBusinessId || 0));
      if (!biz) {
        const [currentUser] = await db.select().from(users).where(eq(users.id, req.user?.id));
        if (currentUser?.pendingMembershipTier) {
          return res.json({
            active: true,
            tier: currentUser.pendingMembershipTier,
            tierDisplay: DB_TO_TIER[currentUser.pendingMembershipTier || ""] || currentUser.pendingMembershipTier || "none",
            frequency: currentUser.pendingPaymentFrequency,
            pendingBusinessCreation: true,
            hasStripeSubscription: !!currentUser.pendingStripeSubscriptionId,
          });
        }
        return res.json({ active: false, tier: "none" });
      }

      let cancelAtPeriodEnd = false;
      let cancelAt: string | null = null;
      if (biz.stripeSubscriptionId) {
        try {
          const sub = await stripe.subscriptions.retrieve(biz.stripeSubscriptionId);
          cancelAtPeriodEnd = sub.cancel_at_period_end;
          if (sub.cancel_at) {
            cancelAt = new Date(sub.cancel_at * 1000).toISOString();
          } else if (sub.cancel_at_period_end && sub.current_period_end) {
            cancelAt = new Date(sub.current_period_end * 1000).toISOString();
          }
        } catch (e) {
          console.error("Failed to check Stripe subscription status:", e);
        }
      }

      res.json({
        active: biz.membershipTier !== "none" && biz.membershipTier !== null,
        tier: biz.membershipTier || "none",
        tierDisplay: DB_TO_TIER[biz.membershipTier || ""] || biz.membershipTier || "none",
        frequency: biz.membershipPaymentFrequency,
        startDate: biz.membershipStartDate,
        endDate: biz.membershipEndDate,
        hasStripeSubscription: !!biz.stripeSubscriptionId,
        cancelAtPeriodEnd,
        cancelAt,
      });
    } catch (err: any) {
      console.error("Subscription status error:", err);
      res.status(500).json({ message: "Failed to fetch subscription status" });
    }
  });

  app.post("/api/stripe/verify-session", isAuthenticated, async (req: any, res: Response) => {
    try {
      const { sessionId } = req.body;
      if (!sessionId) {
        return res.status(400).json({ message: "Session ID is required" });
      }

      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }

      if (session.payment_status !== "paid" && !session.subscription) {
        return res.status(400).json({ message: "Payment not completed", status: session.payment_status });
      }

      if (session.metadata?.type === "job_listing") {
        const jobId = parseInt(session.metadata?.jobListingId || "0");
        if (jobId) {
          const [existing] = await db.select().from(jobListings).where(eq(jobListings.id, jobId));
          if (existing && !existing.isActive) {
            const paidThrough = new Date();
            paidThrough.setDate(paidThrough.getDate() + 7);
            await db.update(jobListings).set({
              isActive: true,
              paidThroughDate: paidThrough,
              stripeSubscriptionId: session.subscription as string,
            }).where(eq(jobListings.id, jobId));
            console.log(`Job listing ${jobId} activated via session verification`);
          }
        }
        return res.json({ success: true, type: "job_listing" });
      }

      if (session.metadata?.type === "ad_placement") {
        const adId = parseInt(session.metadata?.adPlacementId || "0");
        if (adId) {
          const [existing] = await db.select().from(adPlacements).where(eq(adPlacements.id, adId));
          if (existing && existing.paymentStatus !== "paid") {
            const amountPaid = session.amount_total || 0;
            await db.update(adPlacements).set({
              paymentStatus: "paid",
              totalPaid: amountPaid,
              paymentNotes: `Stripe payment ${session.payment_intent || session.id} (verified)`,
            }).where(eq(adPlacements.id, adId));
            console.log(`Ad placement ${adId} paid via session verification (${amountPaid} cents)`);
          }
        }
        return res.json({ success: true, type: "ad_placement" });
      }

      if (session.metadata?.type === "event_ad") {
        const eventId = parseInt(session.metadata?.eventId || "0");
        if (eventId) {
          const [existing] = await db.select().from(events).where(eq(events.id, eventId));
          if (existing && existing.paymentStatus !== "paid") {
            const amountPaid = session.amount_total || 0;
            await db.update(events).set({
              paymentStatus: "paid",
              priceCharged: amountPaid,
            }).where(eq(events.id, eventId));
            console.log(`Event ${eventId} paid via session verification (${amountPaid} cents)`);
          }
        }
        return res.json({ success: true, type: "event_ad" });
      }

      const businessId = parseInt(session.metadata?.businessId || "0");
      const tier = session.metadata?.tier;
      const frequency = session.metadata?.frequency;

      if (businessId && tier) {
        const [biz] = await db.select().from(businesses).where(eq(businesses.id, businessId));
        if (biz && (biz.membershipTier === "none" || !biz.membershipTier || biz.membershipTier !== tier)) {
          const updates: any = {
            membershipTier: tier,
            membershipPaymentFrequency: frequency,
            membershipStartDate: new Date(),
            stripeSubscriptionId: session.subscription as string,
          };

          const isAutoUpgrade = session.metadata?.isAutoUpgrade === "true";
          const originalTier = session.metadata?.originalTier;

          if (session.subscription) {
            try {
              const sub = await stripe.subscriptions.retrieve(session.subscription as string);
              if (sub.trial_end) {
                updates.membershipTrialUsed = true;
                if (isAutoUpgrade && originalTier) {
                  updates.goldTrialEndDate = new Date(sub.trial_end * 1000);
                  updates.originalMembershipTier = originalTier;
                }
              }
            } catch (e) {}
          }

          if (tier === "premium" && !isAutoUpgrade) {
            updates.goldTrialEndDate = null;
            updates.originalMembershipTier = null;
          }

          await db.update(businesses).set(updates).where(eq(businesses.id, businessId));
          console.log(`Membership activated via session verification: business ${businessId} → ${tier}`);
          await processMembershipActivation(businessId).catch((e) => console.error("[referrals] verify-session:", e));

          const promoCodeIdStr = session.metadata?.promoCodeId;
          if (promoCodeIdStr) {
            const promoCodeId = parseInt(promoCodeIdStr);
            const existingUsage = await db.select({ id: promoCodeUsages.id }).from(promoCodeUsages)
              .where(eq(promoCodeUsages.stripeSessionId, session.id)).limit(1);
            if (existingUsage.length === 0) {
              await db.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1` }).where(eq(promoCodes.id, promoCodeId));
              await db.insert(promoCodeUsages).values({
                promoCodeId,
                businessId,
                stripeSessionId: session.id,
              });
              console.log(`Promo code ${promoCodeId} usage recorded via session verification for business ${businessId}`);
            }
          }
        }
        return res.json({ success: true, type: "membership", tier: DB_TO_TIER[tier] || tier });
      }

      const checkoutUserId = session.metadata?.userId;
      const authenticatedUserId = (req as any).user?.id;
      console.log(`[VERIFY-SESSION] No businessId. checkoutUserId=${checkoutUserId}, authUserId=${authenticatedUserId}, tier=${tier}, paymentStatus=${session.payment_status}, subscription=${session.subscription}`);
      if (!businessId && checkoutUserId && tier && checkoutUserId === authenticatedUserId) {
        const [checkoutUser] = await db.select().from(users).where(eq(users.id, checkoutUserId));
        console.log(`[VERIFY-SESSION] User found: linkedBusinessId=${checkoutUser?.linkedBusinessId}, pendingTier=${checkoutUser?.pendingMembershipTier}`);
        if (checkoutUser?.linkedBusinessId) {
          const updates: any = {
            membershipTier: tier,
            membershipPaymentFrequency: frequency,
            membershipStartDate: new Date(),
            stripeSubscriptionId: session.subscription as string,
            stripeCustomerId: session.customer as string,
            membershipTrialUsed: true,
          };

          const isAutoUpgrade = session.metadata?.isAutoUpgrade === "true";
          const originalTier = session.metadata?.originalTier;
          if (session.subscription) {
            try {
              const sub = await stripe.subscriptions.retrieve(session.subscription as string);
              if (sub.trial_end && isAutoUpgrade && originalTier) {
                updates.goldTrialEndDate = new Date(sub.trial_end * 1000);
                updates.originalMembershipTier = originalTier;
              }
            } catch (e) {}
          }

          await db.update(businesses).set(updates).where(eq(businesses.id, checkoutUser.linkedBusinessId));
          console.log(`Membership applied directly via verify-session: business ${checkoutUser.linkedBusinessId} → ${tier}`);
          await processMembershipActivation(checkoutUser.linkedBusinessId).catch((e) => console.error("[referrals] verify-session-linked:", e));

          try {
            if (session.subscription) {
              await stripe.subscriptions.update(session.subscription as string, {
                metadata: { businessId: String(checkoutUser.linkedBusinessId) },
              });
            }
          } catch (e) {}

          const promoCodeIdStr2 = session.metadata?.promoCodeId;
          if (promoCodeIdStr2) {
            const promoCodeId2 = parseInt(promoCodeIdStr2);
            const existingUsage2 = await db.select({ id: promoCodeUsages.id }).from(promoCodeUsages)
              .where(eq(promoCodeUsages.stripeSessionId, session.id)).limit(1);
            if (existingUsage2.length === 0) {
              await db.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1` }).where(eq(promoCodes.id, promoCodeId2));
              await db.insert(promoCodeUsages).values({
                promoCodeId: promoCodeId2,
                businessId: checkoutUser.linkedBusinessId,
                stripeSessionId: session.id,
              });
              console.log(`Promo code ${promoCodeId2} usage recorded via verify-session (linked business) for business ${checkoutUser.linkedBusinessId}`);
            }
          }

          return res.json({ success: true, type: "membership", tier: DB_TO_TIER[tier] || tier });
        } else {
          await db.update(users).set({
            pendingMembershipTier: tier,
            pendingStripeSubscriptionId: session.subscription as string,
            pendingPaymentFrequency: frequency || null,
            stripeCustomerId: session.customer as string,
          }).where(eq(users.id, checkoutUserId));
          console.log(`Pending membership stored via verify-session for user ${checkoutUserId} → ${tier}`);
          return res.json({ success: true, type: "pending_membership", tier: DB_TO_TIER[tier] || tier });
        }
      }

      return res.json({ success: true, type: "unknown" });
    } catch (err: any) {
      console.error("Session verification error:", err);
      res.status(500).json({ message: err.message || "Failed to verify session" });
    }
  });

  app.post("/api/stripe/job-checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const { jobListingId } = req.body;

      if (!jobListingId) {
        return res.status(400).json({ message: "Job listing ID is required" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.linkedBusinessId) {
        return res.status(403).json({ message: "Only business accounts can purchase job listings" });
      }

      const [listing] = await db.select().from(jobListings).where(eq(jobListings.id, jobListingId));
      if (!listing) {
        return res.status(404).json({ message: "Job listing not found" });
      }
      if (listing.businessId !== user.linkedBusinessId) {
        return res.status(403).json({ message: "You can only pay for your own listings" });
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, user.linkedBusinessId));
      if (!biz) {
        return res.status(404).json({ message: "Business not found" });
      }

      if (shouldBypassCharges(req.user, biz)) {
        await db.update(jobListings).set({ isActive: true, paymentStatus: "paid" as any }).where(eq(jobListings.id, jobListingId));
        return res.json({ founderBypass: true, message: "Founder business — job listing activated for free!" });
      }

      const JOB_PRICES_BY_TIER: Record<string, number> = {
        premium: 1000,
        standard: 1500,
        basic: 1800,
        none: 2000,
      };
      const tierKey = getEffectiveTier(biz);
      const unitAmount = JOB_PRICES_BY_TIER[tierKey] ?? 2000;
      const tierLabel = tierKey === "premium" ? "Gold" : tierKey === "standard" ? "Silver" : tierKey === "basic" ? "Bronze" : "Non-Member";

      const customerId = await getOrCreateStripeCustomer(biz.id, req.user.email || user.email || "", biz.name);

      const baseUrl = `https://${req.get("host")}`;

      const session = await stripe!.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Help Wanted Post — ${listing.title}`,
                description: `Weekly job listing for ${biz.name} on Local List 365 (${tierLabel} rate)`,
              },
              unit_amount: unitAmount,
              recurring: { interval: "week", interval_count: 1 },
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/jobs?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${baseUrl}/jobs?canceled=true`,
        metadata: {
          type: "job_listing",
          jobListingId: String(listing.id),
          businessId: String(biz.id),
          userId,
        },
        subscription_data: {
          metadata: {
            type: "job_listing",
            jobListingId: String(listing.id),
            businessId: String(biz.id),
          },
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Job listing checkout error:", err);
      res.status(500).json({ message: err.message || "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/ad-checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const { adPlacementId, promoCode: promoCodeStr } = req.body;

      if (!adPlacementId) {
        return res.status(400).json({ message: "Ad placement ID is required" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.linkedBusinessId) {
        return res.status(403).json({ message: "Only business accounts can purchase ads" });
      }

      const [ad] = await db.select().from(adPlacements).where(eq(adPlacements.id, adPlacementId));
      if (!ad) {
        return res.status(404).json({ message: "Ad placement not found" });
      }
      if (ad.businessId !== user.linkedBusinessId) {
        return res.status(403).json({ message: "You can only pay for your own ads" });
      }
      if (ad.paymentStatus === "paid") {
        return res.status(400).json({ message: "This ad has already been paid for" });
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, user.linkedBusinessId));
      if (!biz) {
        return res.status(404).json({ message: "Business not found" });
      }

      if (shouldBypassCharges(req.user, biz)) {
        await db.update(adPlacements).set({ paymentStatus: "paid", status: "active" }).where(eq(adPlacements.id, adPlacementId));
        return res.json({ founderBypass: true, message: "Founder business — ad activated for free!" });
      }

      const priceInCents = ad.priceMonthly || 25000;
      const customerId = await getOrCreateStripeCustomer(biz.id, req.user.email || user.email || "", biz.name);

      const baseUrl = `https://${req.get("host")}`;

      let stripeCouponId: string | undefined;
      if (promoCodeStr) {
        const [promo] = await db.select().from(promoCodes).where(eq(promoCodes.code, promoCodeStr.toUpperCase().trim()));
        if (promo && promo.isActive && (promo.discountType === "percentage" || promo.discountType === "fixed_amount")) {
          if (promo.discountType === "percentage") {
            const coupon = await stripe!.coupons.create({
              percent_off: promo.discountValue || 0,
              duration: "once",
              name: `Promo: ${promo.code}`,
            });
            stripeCouponId = coupon.id;
          } else {
            const coupon = await stripe!.coupons.create({
              amount_off: Math.round((promo.discountValue || 0) * 100),
              currency: "usd",
              duration: "once",
              name: `Promo: ${promo.code}`,
            });
            stripeCouponId = coupon.id;
          }
          await db.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1` }).where(eq(promoCodes.id, promo.id));
          await db.insert(promoCodeUsages).values({ promoCodeId: promo.id, businessId: biz.id });
        }
      }

      const sizeLabel = (ad.adSize || "small").charAt(0).toUpperCase() + (ad.adSize || "small").slice(1);
      const sessionConfig: any = {
        customer: customerId,
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Ad Placement — ${ad.title}`,
                description: `${sizeLabel} ${ad.placementType.replace(/_/g, " ")} ad on Local List 365`,
              },
              unit_amount: priceInCents,
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/advertising?session_id={CHECKOUT_SESSION_ID}&ad_success=true`,
        cancel_url: `${baseUrl}/advertising?canceled=true`,
        metadata: {
          type: "ad_placement",
          adPlacementId: String(ad.id),
          businessId: String(biz.id),
          userId,
        },
      };
      if (stripeCouponId) {
        sessionConfig.discounts = [{ coupon: stripeCouponId }];
      }
      const session = await stripe!.checkout.sessions.create(sessionConfig);

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Ad checkout error:", err);
      res.status(500).json({ message: err.message || "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/event-checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const { eventId } = req.body;

      if (!eventId) {
        return res.status(400).json({ message: "Event ID is required" });
      }

      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user?.linkedBusinessId) {
        return res.status(403).json({ message: "Only business accounts can purchase event ads" });
      }

      const [evt] = await db.select().from(events).where(eq(events.id, eventId));
      if (!evt) {
        return res.status(404).json({ message: "Event not found" });
      }
      if (evt.businessId !== user.linkedBusinessId) {
        return res.status(403).json({ message: "You can only pay for your own events" });
      }
      if (evt.paymentStatus === "paid") {
        return res.status(400).json({ message: "This event has already been paid for" });
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, user.linkedBusinessId));
      if (!biz) {
        return res.status(404).json({ message: "Business not found" });
      }

      if (shouldBypassCharges(req.user, biz)) {
        await db.update(events).set({ paymentStatus: "paid", status: "approved" }).where(eq(events.id, eventId));
        return res.json({ founderBypass: true, message: "Founder business — event ad activated for free!" });
      }

      const priceInCents = (evt.priceCharged || 5000);
      const customerId = await getOrCreateStripeCustomer(biz.id, req.user.email || user.email || "", biz.name);

      const baseUrl = `https://${req.get("host")}`;

      const sizeLabel = (evt.adSize || "small").charAt(0).toUpperCase() + (evt.adSize || "small").slice(1);
      const session = await stripe!.checkout.sessions.create({
        customer: customerId,
        mode: "payment",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Event Ad — ${evt.title}`,
                description: `${sizeLabel} event advertisement on Local List 365`,
              },
              unit_amount: priceInCents,
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/events?session_id={CHECKOUT_SESSION_ID}&event_success=true`,
        cancel_url: `${baseUrl}/events?canceled=true`,
        metadata: {
          type: "event_ad",
          eventId: String(evt.id),
          businessId: String(biz.id),
          userId,
        },
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Event checkout error:", err);
      res.status(500).json({ message: err.message || "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;
    let sigVerified = false;

    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent((req as any).rawBody, sig, webhookSecret);
        sigVerified = true;
      } catch (err: any) {
        console.error("Webhook signature verification failed:", err.message);
        return res.status(400).json({ message: "Webhook signature verification failed" });
      }
    } else if (!webhookSecret) {
      console.warn("STRIPE_WEBHOOK_SECRET not set — processing webhook without signature verification (development only)");
      event = req.body as Stripe.Event;
    } else {
      return res.status(400).json({ message: "Missing stripe-signature header" });
    }

    // High-value write paths (anything that mints credits or money out of
    // thin air) MUST require a verified signature in production. The
    // unverified dev fallback above is convenient locally but lets an
    // attacker forge `checkout.session.completed` events and grant
    // themselves AI credits. Block that explicitly.
    const isProd = process.env.NODE_ENV === "production";
    if (
      isProd &&
      !sigVerified &&
      event?.type === "checkout.session.completed" &&
      (event.data?.object as any)?.metadata?.type === "credit_pack"
    ) {
      console.error("[security] refusing unverified credit_pack webhook in production");
      return res.status(400).json({ message: "Signature required for this event" });
    }

    try {
      switch (event.type) {
        case "checkout.session.completed": {
          const session = event.data.object as Stripe.Checkout.Session;

          if (session.metadata?.type === "job_listing") {
            const jobId = parseInt(session.metadata?.jobListingId || "0");
            if (jobId) {
              const paidThrough = new Date();
              paidThrough.setDate(paidThrough.getDate() + 7);
              await db.update(jobListings).set({
                isActive: true,
                paidThroughDate: paidThrough,
                stripeSubscriptionId: session.subscription as string,
              }).where(eq(jobListings.id, jobId));
              console.log(`Job listing ${jobId} activated via Stripe payment`);
            }
            break;
          }

          if (session.metadata?.type === "ad_placement") {
            if (session.payment_status !== "paid") {
              console.log(`Ad placement checkout not yet paid (status: ${session.payment_status}), skipping`);
              break;
            }
            const adId = parseInt(session.metadata?.adPlacementId || "0");
            if (adId) {
              const [existing] = await db.select().from(adPlacements).where(eq(adPlacements.id, adId));
              if (existing && existing.paymentStatus === "paid") {
                console.log(`Ad placement ${adId} already marked paid, skipping duplicate webhook`);
                break;
              }
              const amountPaid = session.amount_total || 0;
              await db.update(adPlacements).set({
                paymentStatus: "paid",
                totalPaid: amountPaid,
                paymentNotes: `Stripe payment ${session.payment_intent || session.id}`,
              }).where(eq(adPlacements.id, adId));
              console.log(`Ad placement ${adId} paid via Stripe (${amountPaid} cents)`);

              const [paidAd] = await db.select().from(adPlacements).where(eq(adPlacements.id, adId));
              if (paidAd?.businessId) {
                const [biz] = await db.select({ name: businesses.name }).from(businesses).where(eq(businesses.id, paidAd.businessId));
                notifyAdminNewAd(paidAd.title || "Untitled", biz?.name || "Unknown", paidAd.adSize || "small", amountPaid).catch(() => {});
              }
            }
            break;
          }

          if (session.metadata?.type === "credit_pack") {
            if (session.payment_status !== "paid") {
              console.log(`Credit pack checkout not yet paid (status: ${session.payment_status}), skipping`);
              break;
            }
            const businessId = parseInt(session.metadata?.businessId || "0");
            const packSku = session.metadata?.packSku || "";
            const credits = parseInt(session.metadata?.credits || "0");
            const paymentIntentId = (typeof session.payment_intent === "string"
              ? session.payment_intent
              : session.payment_intent?.id) || session.id;
            if (businessId && credits && paymentIntentId) {
              const result = await applyCreditPackPurchase({
                businessId,
                packSku,
                credits,
                revenueCents: session.amount_total || 0,
                stripePaymentIntentId: paymentIntentId,
                stripeSessionId: session.id,
              });
              if (result.ok) {
                console.log(`Credit pack ${packSku} (+${credits}cr) applied to business ${businessId}, new balance ${result.balance}`);
              } else {
                console.error(`Credit pack apply FAILED for business ${businessId}: ${result.reason}`);
              }
            }
            break;
          }

          if (session.metadata?.type === "additional_zip") {
            if (session.payment_status !== "paid") {
              console.log(`Additional-zip checkout not yet paid (status: ${session.payment_status}), skipping`);
              break;
            }
            await handleAdditionalZipCheckoutCompleted(session);
            break;
          }

          if (session.metadata?.type === "event_ad") {
            if (session.payment_status !== "paid") {
              console.log(`Event ad checkout not yet paid (status: ${session.payment_status}), skipping`);
              break;
            }
            const eventId = parseInt(session.metadata?.eventId || "0");
            if (eventId) {
              const [existing] = await db.select().from(events).where(eq(events.id, eventId));
              if (existing && existing.paymentStatus === "paid") {
                console.log(`Event ${eventId} already marked paid, skipping duplicate webhook`);
                break;
              }
              const amountPaid = session.amount_total || 0;
              await db.update(events).set({
                paymentStatus: "paid",
                priceCharged: amountPaid,
              }).where(eq(events.id, eventId));
              console.log(`Event ${eventId} paid via Stripe (${amountPaid} cents)`);
            }
            break;
          }

          const businessId = parseInt(session.metadata?.businessId || "0");
          const tier = session.metadata?.tier;
          const frequency = session.metadata?.frequency;
          const checkoutUserId = session.metadata?.userId;

          if (businessId && tier) {
            const updates: any = {
              membershipTier: tier,
              membershipPaymentFrequency: frequency,
              membershipStartDate: new Date(),
              stripeSubscriptionId: session.subscription as string,
            };

            const isAutoUpgrade = session.metadata?.isAutoUpgrade === "true";
            const originalTier = session.metadata?.originalTier;

            if (session.subscription) {
              const sub = await stripe.subscriptions.retrieve(session.subscription as string);
              if (sub.trial_end) {
                updates.membershipTrialUsed = true;
                if (isAutoUpgrade && originalTier) {
                  updates.goldTrialEndDate = new Date(sub.trial_end * 1000);
                  updates.originalMembershipTier = originalTier;
                }
              }
            }

            if (tier === "premium" && !isAutoUpgrade) {
              updates.goldTrialEndDate = null;
              updates.originalMembershipTier = null;
            }

            await db.update(businesses).set(updates).where(eq(businesses.id, businessId));
            console.log(`Membership activated: business ${businessId} → ${tier}`);
            await processMembershipActivation(businessId).catch((e) => console.error("[referrals] webhook:", e));

            const promoCodeIdStr = session.metadata?.promoCodeId;
            if (promoCodeIdStr) {
              const promoCodeId = parseInt(promoCodeIdStr);
              const existingUsage = await db.select({ id: promoCodeUsages.id }).from(promoCodeUsages)
                .where(eq(promoCodeUsages.stripeSessionId, session.id)).limit(1);
              if (existingUsage.length === 0) {
                await db.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1` }).where(eq(promoCodes.id, promoCodeId));
                await db.insert(promoCodeUsages).values({
                  promoCodeId,
                  businessId,
                  stripeSessionId: session.id,
                });
                console.log(`Promo code ${promoCodeId} usage recorded for business ${businessId}`);
              }
            }
          } else if (!businessId && checkoutUserId && tier) {
            console.log(`[WEBHOOK] New user checkout: userId=${checkoutUserId}, tier=${tier}, subscription=${session.subscription}`);
            const [checkoutUser] = await db.select().from(users).where(eq(users.id, checkoutUserId));
            console.log(`[WEBHOOK] User state: linkedBusinessId=${checkoutUser?.linkedBusinessId}, pendingTier=${checkoutUser?.pendingMembershipTier}`);
            if (checkoutUser?.linkedBusinessId) {
              const updates: any = {
                membershipTier: tier,
                membershipPaymentFrequency: frequency,
                membershipStartDate: new Date(),
                stripeSubscriptionId: session.subscription as string,
                stripeCustomerId: session.customer as string,
                membershipTrialUsed: true,
              };

              const isAutoUpgradeWh = session.metadata?.isAutoUpgrade === "true";
              const originalTierWh = session.metadata?.originalTier;
              if (session.subscription) {
                try {
                  const sub = await stripe.subscriptions.retrieve(session.subscription as string);
                  if (sub.trial_end && isAutoUpgradeWh && originalTierWh) {
                    updates.goldTrialEndDate = new Date(sub.trial_end * 1000);
                    updates.originalMembershipTier = originalTierWh;
                  }
                } catch (e) {
                  console.error("Failed to retrieve subscription for trial info (linked business path):", e);
                }
              }
              if (tier === "premium" && !isAutoUpgradeWh) {
                updates.goldTrialEndDate = null;
                updates.originalMembershipTier = null;
              }

              await db.update(businesses).set(updates).where(eq(businesses.id, checkoutUser.linkedBusinessId));
              console.log(`Membership applied directly to business ${checkoutUser.linkedBusinessId} → ${tier} (user already had business)`);
              await processMembershipActivation(checkoutUser.linkedBusinessId).catch((e) => console.error("[referrals] webhook-linked:", e));

              if (session.subscription) {
                try {
                  await stripe.subscriptions.update(session.subscription as string, {
                    metadata: { businessId: String(checkoutUser.linkedBusinessId) },
                  });
                } catch (e) {
                  console.error("Failed to update subscription metadata:", e);
                }
              }

              const promoCodeIdStr = session.metadata?.promoCodeId;
              if (promoCodeIdStr) {
                const promoCodeId = parseInt(promoCodeIdStr);
                const existingUsage = await db.select({ id: promoCodeUsages.id }).from(promoCodeUsages)
                  .where(eq(promoCodeUsages.stripeSessionId, session.id)).limit(1);
                if (existingUsage.length === 0) {
                  await db.update(promoCodes).set({ currentUses: sql`${promoCodes.currentUses} + 1` }).where(eq(promoCodes.id, promoCodeId));
                  await db.insert(promoCodeUsages).values({
                    promoCodeId,
                    businessId: checkoutUser.linkedBusinessId,
                    stripeSessionId: session.id,
                  });
                }
              }
            } else {
              await db.update(users).set({
                pendingMembershipTier: tier,
                pendingStripeSubscriptionId: session.subscription as string,
                pendingPaymentFrequency: frequency || null,
                stripeCustomerId: session.customer as string,
              }).where(eq(users.id, checkoutUserId));
              console.log(`Pending membership stored for user ${checkoutUserId} → ${tier} (business not yet created)`);
            }
          }
          break;
        }

        case "customer.subscription.updated": {
          const subscription = event.data.object as Stripe.Subscription;
          let businessId = parseInt(subscription.metadata?.businessId || "0");

          if (!businessId) {
            const [biz] = await db.select().from(businesses).where(eq(businesses.stripeSubscriptionId, subscription.id));
            businessId = biz?.id || 0;
          }
          if (!businessId && subscription.customer) {
            const [biz] = await db.select().from(businesses).where(eq(businesses.stripeCustomerId, subscription.customer as string));
            businessId = biz?.id || 0;
          }

          if (businessId) {
            const status = subscription.status;
            if (status === "active" || status === "trialing") {
              let newTier = subscription.metadata?.tier;
              const isAutoUpgrade = subscription.metadata?.isAutoUpgrade === "true";
              const originalTier = subscription.metadata?.originalTier;

              const isTrialReversion = isAutoUpgrade && status === "active" && originalTier;
              if (isTrialReversion) {
                newTier = originalTier;
                console.log(`Auto-upgrade trial ended: business ${businessId} reverting from Gold to ${DB_TO_TIER[originalTier] || originalTier}`);
              }

              if (newTier) {
                const [currentBiz] = await db.select({ membershipTier: businesses.membershipTier }).from(businesses).where(eq(businesses.id, businessId));
                const oldTier = currentBiz?.membershipTier;

                if (!isTrialReversion && oldTier && oldTier !== newTier && oldTier !== "none") {
                  const tierRank: Record<string, number> = { premium: 3, standard: 2, basic: 1, none: 0 };
                  if ((tierRank[oldTier] || 0) > (tierRank[newTier] || 0)) {
                    const winBackDate = new Date();
                    winBackDate.setMonth(winBackDate.getMonth() + 2);
                    await db.insert(membershipDowngrades).values({
                      businessId,
                      previousTier: oldTier,
                      newTier,
                      winBackEligibleAt: winBackDate,
                    });
                    console.log(`Downgrade recorded: business ${businessId} from ${oldTier} to ${newTier}, win-back eligible at ${winBackDate.toISOString()}`);
                  }
                }

                const updateFields: any = {
                  membershipTier: newTier,
                  stripeSubscriptionId: subscription.id,
                };
                if (isTrialReversion || (newTier === "premium" && !isAutoUpgrade)) {
                  updateFields.goldTrialEndDate = null;
                  updateFields.originalMembershipTier = null;
                }
                await db.update(businesses).set(updateFields).where(eq(businesses.id, businessId));
              }
            } else if (status === "past_due" || status === "unpaid") {
              console.warn(`Subscription ${subscription.id} status: ${status} for business ${businessId}`);
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
          const subscription = event.data.object as Stripe.Subscription;

          if (subscription.metadata?.type === "additional_zip") {
            await handleAdditionalZipSubscriptionDeleted(subscription);
            break;
          }

          if (subscription.metadata?.type === "job_listing") {
            const jobId = parseInt(subscription.metadata?.jobListingId || "0");
            if (jobId) {
              const [existingListing] = await db.select().from(jobListings).where(eq(jobListings.id, jobId));
              if (existingListing && existingListing.stripeSubscriptionId === subscription.id) {
                await db.update(jobListings).set({
                  isActive: false,
                  stripeSubscriptionId: null,
                }).where(eq(jobListings.id, jobId));
                console.log(`Job listing ${jobId} deactivated — subscription canceled`);
              }
            }
            break;
          }

          await handleMembershipSubscriptionDeleted(subscription);
          break;
        }

        case "invoice.payment_succeeded": {
          // Referral reward: when a referee converts trial → paid on their
          // MEMBERSHIP subscription, credit the referrer with one month
          // on their next invoice. Job-listing, additional-zip, and other
          // non-membership invoices for the same customer must NEVER
          // consume the pending referral.
          //
          // Gating layers (all required):
          //   1. `sub.metadata.type` — skip known non-membership types.
          //   2. `businesses.stripeSubscriptionId === sub.id` — the
          //      membership subscription is tracked exclusively in this
          //      column. Job listings and additional zips track theirs in
          //      `jobListings.stripeSubscriptionId` and child business
          //      rows respectively, so a mismatch here means it isn't a
          //      membership invoice and we bail out.
          //   3. amount_paid > 0 (enforced inside the processor).
          const invoice = event.data.object as Stripe.Invoice;
          // Any paid invoice may have consumed pending credit on this
          // customer's balance, so drop the cached value regardless of
          // which subscription type fired the event.
          const invoiceCustomerId =
            typeof invoice.customer === "string"
              ? invoice.customer
              : invoice.customer && typeof invoice.customer === "object" && "id" in invoice.customer
                ? (invoice.customer as { id: string }).id
                : null;
          if (invoiceCustomerId) {
            // Drop the cache AND re-read the customer balance so the
            // persisted last-known credit reflects whatever Stripe just
            // consumed against this invoice. Without the persist step,
            // an outage right after this webhook could leave the
            // dashboard overstating the balance until the next live
            // read succeeded. Best-effort: failures are logged inside
            // the helper and never throw.
            await refreshPersistedCreditFromStripe(invoiceCustomerId, stripe!).catch((e) =>
              console.error("[referrals] refreshPersistedCreditFromStripe:", e),
            );
          }
          const subId = invoice.subscription as string | null;
          if (subId) {
            try {
              const sub = await stripe!.subscriptions.retrieve(subId);
              const subType = sub.metadata?.type;
              if (subType && subType !== "membership") {
                // Job listing, additional zip, etc.
                break;
              }
              const [biz] = await db.select({ id: businesses.id })
                .from(businesses)
                .where(eq(businesses.stripeSubscriptionId, subId));
              if (biz?.id) {
                await processReferralOnFirstPaidInvoice({
                  referredBusinessId: biz.id,
                  invoice,
                  stripe: stripe!,
                }).catch((e) => console.error("[referrals] invoice.payment_succeeded:", e));
              }
            } catch (err: any) {
              console.error("[referrals] failed to resolve business for invoice", invoice.id, err?.message);
            }
          }
          break;
        }

        case "invoice.paid": {
          const invoice = event.data.object as Stripe.Invoice;
          const subId = invoice.subscription as string;
          if (subId) {
            const sub = await stripe!.subscriptions.retrieve(subId);
            if (sub.metadata?.type === "job_listing") {
              const jobId = parseInt(sub.metadata?.jobListingId || "0");
              if (jobId) {
                const paidThrough = new Date();
                paidThrough.setDate(paidThrough.getDate() + 7);
                await db.update(jobListings).set({
                  isActive: true,
                  paidThroughDate: paidThrough,
                }).where(eq(jobListings.id, jobId));
                console.log(`Job listing ${jobId} renewed — paid through ${paidThrough.toISOString()}`);
              }
            }
          }
          break;
        }

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subId = invoice.subscription as string;
          if (subId) {
            const sub = await stripe!.subscriptions.retrieve(subId);
            if (sub.metadata?.type === "job_listing") {
              const jobId = parseInt(sub.metadata?.jobListingId || "0");
              if (jobId) {
                console.warn(`Payment failed for job listing ${jobId}, subscription ${subId}`);
              }
              break;
            }
            const [biz] = await db.select().from(businesses).where(eq(businesses.stripeSubscriptionId, subId));
            if (biz) {
              console.warn(`Payment failed for business ${biz.id}, subscription ${subId}`);
            }
          }
          break;
        }
      }

      res.json({ received: true });
    } catch (err: any) {
      console.error("Webhook processing error:", err);
      res.status(500).json({ message: "Webhook processing failed" });
    }
  });
}
