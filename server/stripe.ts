import Stripe from "stripe";
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { businesses, promoCodes, promoCodeUsages, membershipDowngrades, jobListings, users, adPlacements } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";

if (!process.env.Stripeintegration) {
  console.warn("Stripe secret key not configured — payment features disabled");
}

const stripe = process.env.Stripeintegration
  ? new Stripe(process.env.Stripeintegration, { apiVersion: "2025-02-24.acacia" as any })
  : null;

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

const TIER_PRICES: Record<string, Record<string, number>> = {
  bronze: { monthly: 5000, semi_annual: 24000, annual: 33000 },
  silver: { monthly: 10000, semi_annual: 48000, annual: 66000 },
  gold: { monthly: 20000, semi_annual: 96000, annual: 132000 },
};

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

      let promoDiscount = 0;
      let promoId: number | null = null;
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
        if (promo.applicableTiers?.length && !promo.applicableTiers.includes(tier)) {
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
        if (promo.discountType === "percentage") {
          promoDiscount = promo.discountValue / 100;
        } else {
          promoDiscount = promo.discountValue;
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

      let priceAmount = TIER_PRICES[tier][frequency];

      if (promoDiscount > 0 && promoId) {
        if (promoDiscount <= 1) {
          priceAmount = Math.round(priceAmount * (1 - promoDiscount));
        } else {
          priceAmount = Math.max(0, priceAmount - promoDiscount * 100);
        }
      }

      const isNewMember = biz ? !biz.membershipTrialUsed : true;
      const effectiveTier = (tier === "bronze" || tier === "silver") && isNewMember ? "gold" : tier;
      const effectiveDbTier = TIER_TO_DB[effectiveTier];
      const isAutoUpgrade = effectiveTier !== tier;

      const intervalConfig = FREQUENCY_INTERVAL[frequency];
      const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
      const freqLabel = frequency === "monthly" ? "Monthly" : frequency === "semi_annual" ? "Semi-Annual" : "Annual";

      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
        : process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

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
                name: `Local List 365 — ${tierName} Membership (${freqLabel})${isAutoUpgrade ? ' — Gold Trial' : ''}`,
                description: isAutoUpgrade
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

      if (isNewMember) {
        sessionParams.subscription_data.trial_period_days = 30;
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

      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
        : process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

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
      if (!businessId && checkoutUserId && tier && checkoutUserId === authenticatedUserId) {
        const [checkoutUser] = await db.select().from(users).where(eq(users.id, checkoutUserId));
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

          try {
            if (session.subscription) {
              await stripe.subscriptions.update(session.subscription as string, {
                metadata: { businessId: String(checkoutUser.linkedBusinessId) },
              });
            }
          } catch (e) {}

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

      const JOB_PRICES_BY_TIER: Record<string, number> = {
        premium: 1000,
        standard: 1500,
        basic: 1800,
        none: 2000,
      };
      const tierKey = biz.membershipTier || "none";
      const unitAmount = JOB_PRICES_BY_TIER[tierKey] ?? 2000;
      const tierLabel = tierKey === "premium" ? "Gold" : tierKey === "standard" ? "Silver" : tierKey === "basic" ? "Bronze" : "Basic";

      const customerId = await getOrCreateStripeCustomer(biz.id, req.user.email || user.email || "", biz.name);

      const baseUrl = process.env.REPLIT_DEPLOYMENT_URL
        ? `https://${process.env.REPLIT_DEPLOYMENT_URL}`
        : process.env.REPLIT_DEV_DOMAIN
          ? `https://${process.env.REPLIT_DEV_DOMAIN}`
          : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

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
      const { adPlacementId } = req.body;

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

      const priceInCents = ad.priceMonthly || 25000;
      const customerId = await getOrCreateStripeCustomer(biz.id, req.user.email || user.email || "", biz.name);

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

      const sizeLabel = (ad.adSize || "small").charAt(0).toUpperCase() + (ad.adSize || "small").slice(1);
      const session = await stripe!.checkout.sessions.create({
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
      });

      res.json({ url: session.url });
    } catch (err: any) {
      console.error("Ad checkout error:", err);
      res.status(500).json({ message: err.message || "Failed to create checkout session" });
    }
  });

  app.post("/api/stripe/webhook", async (req: Request, res: Response) => {
    const sig = req.headers["stripe-signature"];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      try {
        event = stripe.webhooks.constructEvent((req as any).rawBody, sig, webhookSecret);
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
            const [checkoutUser] = await db.select().from(users).where(eq(users.id, checkoutUserId));
            if (checkoutUser?.linkedBusinessId) {
              const updates: any = {
                membershipTier: tier,
                membershipPaymentFrequency: frequency,
                membershipStartDate: new Date(),
                stripeSubscriptionId: session.subscription as string,
                stripeCustomerId: session.customer as string,
                membershipTrialUsed: true,
              };
              await db.update(businesses).set(updates).where(eq(businesses.id, checkoutUser.linkedBusinessId));
              console.log(`Membership applied directly to business ${checkoutUser.linkedBusinessId} → ${tier} (user already had business)`);

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
            const [currentBiz] = await db.select({ membershipTier: businesses.membershipTier }).from(businesses).where(eq(businesses.id, businessId));
            const oldTier = currentBiz?.membershipTier;

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
