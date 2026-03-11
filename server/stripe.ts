import Stripe from "stripe";
import type { Express, Request, Response } from "express";
import { db } from "./db";
import { businesses } from "@shared/schema";
import { eq } from "drizzle-orm";
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
  if (biz?.stripeCustomerId) return biz.stripeCustomerId;

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
    return;
  }

  app.post("/api/stripe/create-checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const { tier, frequency } = req.body;

      if (!tier || !frequency) {
        return res.status(400).json({ message: "Tier and frequency are required" });
      }

      if (!TIER_PRICES[tier] || !TIER_PRICES[tier][frequency]) {
        return res.status(400).json({ message: "Invalid tier or frequency" });
      }

      const [biz] = await db.select().from(businesses).where(eq(businesses.id, req.user?.linkedBusinessId || 0));
      if (!biz) {
        return res.status(404).json({ message: "No business found for your account. Please create a business listing first." });
      }

      const customerId = await getOrCreateStripeCustomer(biz.id, req.user.email, biz.name);
      const priceAmount = TIER_PRICES[tier][frequency];
      const intervalConfig = FREQUENCY_INTERVAL[frequency];
      const tierName = tier.charAt(0).toUpperCase() + tier.slice(1);
      const freqLabel = frequency === "monthly" ? "Monthly" : frequency === "semi_annual" ? "Semi-Annual" : "Annual";

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
        ? `https://${process.env.REPLIT_DEV_DOMAIN}`
        : `https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`;

      const isNewMember = !biz.membershipTrialUsed;

      const sessionParams: Stripe.Checkout.SessionCreateParams = {
        customer: customerId,
        mode: "subscription",
        line_items: [
          {
            price_data: {
              currency: "usd",
              product_data: {
                name: `Local List 365 — ${tierName} Membership (${freqLabel})`,
                description: `${tierName} tier membership for ${biz.name}`,
              },
              unit_amount: priceAmount,
              recurring: intervalConfig,
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/membership?session_id={CHECKOUT_SESSION_ID}&success=true`,
        cancel_url: `${baseUrl}/membership?canceled=true`,
        metadata: {
          businessId: String(biz.id),
          tier: TIER_TO_DB[tier],
          frequency,
          userId,
        },
      };

      sessionParams.subscription_data = {
        metadata: {
          businessId: String(biz.id),
          tier: TIER_TO_DB[tier],
          frequency,
        },
      };

      if (isNewMember) {
        sessionParams.subscription_data.trial_period_days = 30;
      }

      const session = await stripe.checkout.sessions.create(sessionParams);
      res.json({ url: session.url });
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

      const baseUrl = process.env.REPLIT_DEV_DOMAIN
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
        return res.json({ active: false, tier: "none" });
      }

      res.json({
        active: biz.membershipTier !== "none" && biz.membershipTier !== null,
        tier: biz.membershipTier || "none",
        tierDisplay: DB_TO_TIER[biz.membershipTier || ""] || biz.membershipTier || "none",
        frequency: biz.membershipPaymentFrequency,
        startDate: biz.membershipStartDate,
        endDate: biz.membershipEndDate,
        hasStripeSubscription: !!biz.stripeSubscriptionId,
      });
    } catch (err: any) {
      console.error("Subscription status error:", err);
      res.status(500).json({ message: "Failed to fetch subscription status" });
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
          const businessId = parseInt(session.metadata?.businessId || "0");
          const tier = session.metadata?.tier;
          const frequency = session.metadata?.frequency;

          if (businessId && tier) {
            const updates: any = {
              membershipTier: tier,
              membershipPaymentFrequency: frequency,
              membershipStartDate: new Date(),
              stripeSubscriptionId: session.subscription as string,
            };

            if (session.subscription) {
              const sub = await stripe.subscriptions.retrieve(session.subscription as string);
              if (sub.trial_end) {
                updates.membershipTrialUsed = true;
              }
            }

            await db.update(businesses).set(updates).where(eq(businesses.id, businessId));
            console.log(`Membership activated: business ${businessId} → ${tier}`);
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
              const tier = subscription.metadata?.tier;
              if (tier) {
                await db.update(businesses).set({
                  membershipTier: tier,
                  stripeSubscriptionId: subscription.id,
                }).where(eq(businesses.id, businessId));
              }
            } else if (status === "past_due" || status === "unpaid") {
              console.warn(`Subscription ${subscription.id} status: ${status} for business ${businessId}`);
            }
          }
          break;
        }

        case "customer.subscription.deleted": {
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

        case "invoice.payment_failed": {
          const invoice = event.data.object as Stripe.Invoice;
          const subId = invoice.subscription as string;
          if (subId) {
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
