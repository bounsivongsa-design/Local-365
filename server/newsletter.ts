/**
 * Marketing Suite Feature #1 — Email Newsletter
 *
 * Owner-facing endpoints for managing a Gold business's customer newsletter.
 * Replaces Mailchimp/Constant Contact (~$15-50/mo) for our Gold members.
 *
 * Subscriber list is built three ways:
 *   1. Backfill from past quote_requests (customer_email column) + reviews
 *      (joined to users.email). Idempotent — UNIQUE(business_id,email).
 *   2. Manual add by the owner.
 *   3. (Future) Auto-add hook on new quote_request / review.
 *
 * Sending: composes via Resend, writes a per-recipient newsletter_sends row
 * for tracking & idempotency, appends a CAN-SPAM-compliant footer with the
 * business's physical address + a one-click unsubscribe link.
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { Resend } from "resend";
import { db as pgDb } from "./db";
import { isCompActive } from "@shared/config/membership";
import {
  businesses,
  users,
  reviews,
  quoteRequests,
  newsletterSubscribers,
  newsletterCampaigns,
  newsletterSends,
} from "@shared/schema";
import { and, eq, isNull, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";

/**
 * Effective tier check. Uses the IMMUTABLE `isFoundingMember` column —
 * NOT business name — so an owner can't rename their business to bypass
 * Gold gating. (Other older modules in this codebase still use a
 * name-based founder check; those are pre-existing tech debt.)
 */
function effectiveTier(b: {
  membershipTier: string | null;
  goldTrialEndDate: Date | null;
  isFoundingMember?: boolean | null;
}): string {
  if (b.isFoundingMember === true) return "premium";
  if (isCompActive(b)) return "premium";
  if (b.membershipTier === "premium") return "premium";
  if (b.goldTrialEndDate && new Date(b.goldTrialEndDate) > new Date()) {
    return "premium";
  }
  return b.membershipTier ?? "none";
}

async function authorizeOwner(
  req: Request,
  res: Response,
  businessId: number,
  requireGold = false,
): Promise<{ business: typeof businesses.$inferSelect } | null> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const [user] = await pgDb
    .select({ id: users.id, linkedBusinessId: users.linkedBusinessId })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const [biz] = await pgDb
    .select()
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!biz) {
    res.status(404).json({ message: "Business not found" });
    return null;
  }
  if (user.linkedBusinessId !== biz.id) {
    res.status(403).json({ message: "You don't own this business" });
    return null;
  }
  if (requireGold && effectiveTier(biz) !== "premium") {
    res.status(403).json({
      message: "Email newsletter requires Gold membership.",
      code: "GOLD_REQUIRED",
    });
    return null;
  }
  return { business: biz };
}

function makeUnsubscribeToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/**
 * Idempotently add a subscriber row. Returns the existing row if already
 * subscribed (even if unsubscribed). UNIQUE(business_id,email) makes this
 * safe to call repeatedly.
 */
async function upsertSubscriber(opts: {
  businessId: number;
  email: string;
  name?: string | null;
  userId?: string | null;
  source: "quote_request" | "review" | "manual" | "import";
}) {
  const email = opts.email.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  const token = makeUnsubscribeToken();
  const inserted = await pgDb
    .insert(newsletterSubscribers)
    .values({
      businessId: opts.businessId,
      email,
      name: opts.name ?? null,
      userId: opts.userId ?? null,
      source: opts.source,
      unsubscribeToken: token,
    })
    .onConflictDoNothing({ target: [newsletterSubscribers.businessId, newsletterSubscribers.email] })
    .returning();
  if (inserted[0]) return inserted[0];
  const [existing] = await pgDb
    .select()
    .from(newsletterSubscribers)
    .where(and(
      eq(newsletterSubscribers.businessId, opts.businessId),
      eq(newsletterSubscribers.email, email),
    ));
  return existing ?? null;
}

/**
 * One-shot backfill: pull every customer_email from this business's
 * quote_requests + every reviewer's email from reviews. Idempotent.
 * Returns count of NEW subscribers added.
 */
async function backfillFromHistory(businessId: number): Promise<number> {
  // Quote requesters who explicitly contacted this business
  const quoteRows = await pgDb
    .select({
      email: quoteRequests.customerEmail,
      name: quoteRequests.customerName,
      userId: quoteRequests.userId,
    })
    .from(quoteRequests)
    .innerJoin(
      // join via the quote rows that targeted us — but quote_requests is
      // broadcast to all matching businesses, not directly tied. Safer to
      // pull only quote rows that received a quote FROM this business.
      // We do this via the quotes table.
      sql`(SELECT DISTINCT request_id FROM quotes WHERE business_id = ${businessId}) AS q`,
      sql`q.request_id = ${quoteRequests.id}`,
    );

  // Reviewers of this business
  const reviewRows = await pgDb
    .select({
      email: users.email,
      firstName: users.firstName,
      lastName: users.lastName,
      userId: users.id,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.businessId, businessId));

  let added = 0;
  for (const r of quoteRows) {
    if (!r.email) continue;
    const before = added;
    const result = await upsertSubscriber({
      businessId,
      email: r.email,
      name: r.name ?? null,
      userId: r.userId ?? null,
      source: "quote_request",
    });
    // crude "was it new" check — getting the inserted row only tells us
    // it now exists. We re-check createdAt vs now (loose).
    if (result && result.createdAt && Date.now() - new Date(result.createdAt).getTime() < 5000) {
      added += 1;
    }
  }
  for (const r of reviewRows) {
    if (!r.email) continue;
    const result = await upsertSubscriber({
      businessId,
      email: r.email,
      name: [r.firstName, r.lastName].filter(Boolean).join(" ") || null,
      userId: r.userId,
      source: "review",
    });
    if (result && result.createdAt && Date.now() - new Date(result.createdAt).getTime() < 5000) {
      added += 1;
    }
  }
  return added;
}

/**
 * Wrap the owner-supplied bodyHtml with a CAN-SPAM-compliant footer:
 *   - Business name
 *   - Physical address
 *   - One-click unsubscribe link
 */
function wrapForSend(opts: {
  business: typeof businesses.$inferSelect;
  bodyHtml: string;
  unsubscribeUrl: string;
  baseUrl: string;
}): string {
  const { business, bodyHtml, unsubscribeUrl } = opts;
  const addressLine = [business.address, business.city, business.state, business.zipCode]
    .filter(Boolean)
    .join(", ");
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: linear-gradient(135deg, #0a4a82, #0d5a9e); color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 18px; font-weight: 600;">${escapeHtml(business.name)}</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e5e5; border-top: none;">
        <div style="font-size: 15px; line-height: 1.6;">${bodyHtml}</div>
      </div>
      <div style="background: #f5f5f5; padding: 18px 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; font-size: 12px; color: #666; line-height: 1.5;">
        <p style="margin: 0 0 8px;">You're receiving this because you've interacted with <strong>${escapeHtml(business.name)}</strong> on Local List 365.</p>
        <p style="margin: 0 0 8px;">${escapeHtml(addressLine)}</p>
        <p style="margin: 0;">
          <a href="${unsubscribeUrl}" style="color: #0a4a82; text-decoration: underline;">Unsubscribe</a>
          &nbsp;·&nbsp;
          Powered by <a href="https://locallist365.replit.app" style="color: #0a4a82; text-decoration: none;">Local List 365</a>
        </p>
      </div>
    </div>
  `;
}

function escapeHtml(s: string | null | undefined): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function getBaseUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

const ManualAddSchema = z.object({
  email: z.string().email().max(254),
  name: z.string().max(120).optional(),
});

const CampaignDraftSchema = z.object({
  subject: z.string().min(2).max(200),
  bodyHtml: z.string().min(10).max(50000),
});

export function registerNewsletterRoutes(app: Express) {
  /* ──────── Subscribers ──────── */

  // List active subscribers for this business
  app.get(
    "/api/businesses/:id/newsletter/subscribers",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      if (!Number.isFinite(businessId)) {
        return res.status(400).json({ message: "Invalid business id" });
      }
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;

      // Idempotent backfill on every load — cheap, ON CONFLICT DO NOTHING
      try {
        await backfillFromHistory(businessId);
      } catch (err: any) {
        console.error("[newsletter] backfill failed:", err?.message);
      }

      const subs = await pgDb
        .select()
        .from(newsletterSubscribers)
        .where(and(
          eq(newsletterSubscribers.businessId, businessId),
          isNull(newsletterSubscribers.unsubscribedAt),
        ))
        .orderBy(desc(newsletterSubscribers.createdAt));
      res.json({ subscribers: subs, total: subs.length });
    },
  );

  // Manual add a subscriber
  app.post(
    "/api/businesses/:id/newsletter/subscribers",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      const parsed = ManualAddSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const sub = await upsertSubscriber({
        businessId,
        email: parsed.data.email,
        name: parsed.data.name ?? null,
        source: "manual",
      });
      if (!sub) return res.status(400).json({ message: "Could not add subscriber" });
      // If they were previously unsubscribed, re-subscribe them
      if (sub.unsubscribedAt) {
        await pgDb
          .update(newsletterSubscribers)
          .set({ unsubscribedAt: null, optedInAt: new Date(), source: "manual" })
          .where(eq(newsletterSubscribers.id, sub.id));
      }
      res.json({ subscriber: { ...sub, unsubscribedAt: null } });
    },
  );

  // Owner removes a subscriber (soft-unsubscribe)
  app.delete(
    "/api/businesses/:id/newsletter/subscribers/:subId",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const subId = Number(req.params.subId);
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      const result = await pgDb
        .update(newsletterSubscribers)
        .set({ unsubscribedAt: new Date() })
        .where(and(
          eq(newsletterSubscribers.id, subId),
          eq(newsletterSubscribers.businessId, businessId),
        ))
        .returning({ id: newsletterSubscribers.id });
      if (!result[0]) return res.status(404).json({ message: "Subscriber not found" });
      res.json({ ok: true });
    },
  );

  /* ──────── Campaigns ──────── */

  // List all campaigns
  app.get(
    "/api/businesses/:id/newsletter/campaigns",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      const rows = await pgDb
        .select()
        .from(newsletterCampaigns)
        .where(eq(newsletterCampaigns.businessId, businessId))
        .orderBy(desc(newsletterCampaigns.createdAt));
      res.json({ campaigns: rows });
    },
  );

  // Create draft (Gold required)
  app.post(
    "/api/businesses/:id/newsletter/campaigns",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const auth = await authorizeOwner(req, res, businessId, true);
      if (!auth) return;
      const parsed = CampaignDraftSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const [row] = await pgDb
        .insert(newsletterCampaigns)
        .values({
          businessId,
          subject: parsed.data.subject,
          bodyHtml: parsed.data.bodyHtml,
          status: "draft",
        })
        .returning();
      res.json({ campaign: row });
    },
  );

  // Edit a draft
  app.patch(
    "/api/businesses/:id/newsletter/campaigns/:cid",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const cid = Number(req.params.cid);
      const auth = await authorizeOwner(req, res, businessId, true);
      if (!auth) return;
      const parsed = CampaignDraftSchema.partial().safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }
      const [existing] = await pgDb
        .select()
        .from(newsletterCampaigns)
        .where(and(
          eq(newsletterCampaigns.id, cid),
          eq(newsletterCampaigns.businessId, businessId),
        ));
      if (!existing) return res.status(404).json({ message: "Campaign not found" });
      if (existing.status !== "draft") {
        return res.status(409).json({ message: "Already sent — cannot edit" });
      }
      const [updated] = await pgDb
        .update(newsletterCampaigns)
        .set({
          ...(parsed.data.subject !== undefined ? { subject: parsed.data.subject } : {}),
          ...(parsed.data.bodyHtml !== undefined ? { bodyHtml: parsed.data.bodyHtml } : {}),
          updatedAt: new Date(),
        })
        .where(eq(newsletterCampaigns.id, cid))
        .returning();
      res.json({ campaign: updated });
    },
  );

  // Send a draft (Gold required)
  app.post(
    "/api/businesses/:id/newsletter/campaigns/:cid/send",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const cid = Number(req.params.cid);
      const auth = await authorizeOwner(req, res, businessId, true);
      if (!auth) return;
      const business = auth.business;

      const [campaign] = await pgDb
        .select()
        .from(newsletterCampaigns)
        .where(and(
          eq(newsletterCampaigns.id, cid),
          eq(newsletterCampaigns.businessId, businessId),
        ));
      if (!campaign) return res.status(404).json({ message: "Campaign not found" });
      if (campaign.status === "sent" || campaign.status === "sending") {
        return res.status(409).json({ message: "Already sent or in progress" });
      }

      const subs = await pgDb
        .select()
        .from(newsletterSubscribers)
        .where(and(
          eq(newsletterSubscribers.businessId, businessId),
          isNull(newsletterSubscribers.unsubscribedAt),
        ));
      if (subs.length === 0) {
        return res.status(400).json({ message: "No active subscribers" });
      }

      // Mark sending
      await pgDb
        .update(newsletterCampaigns)
        .set({
          status: "sending",
          recipientCount: subs.length,
          updatedAt: new Date(),
        })
        .where(eq(newsletterCampaigns.id, cid));

      const apiKey = process.env.RESEND_API_KEY;
      const resend = apiKey ? new Resend(apiKey) : null;
      const baseUrl = getBaseUrl(req);
      let success = 0;
      let failed = 0;

      for (const sub of subs) {
        try {
          const unsubscribeUrl = `${baseUrl}/api/newsletter/unsubscribe/${sub.unsubscribeToken}`;
          const html = wrapForSend({
            business,
            bodyHtml: campaign.bodyHtml,
            unsubscribeUrl,
            baseUrl,
          });

          // Idempotency: insert send-row first; if a duplicate exists for
          // (campaign, sub) we skip.
          const inserted = await pgDb
            .insert(newsletterSends)
            .values({ campaignId: cid, subscriberId: sub.id, status: "queued" })
            .onConflictDoNothing({
              target: [newsletterSends.campaignId, newsletterSends.subscriberId],
            })
            .returning({ id: newsletterSends.id });
          if (!inserted[0]) continue; // already attempted

          if (!resend) {
            console.log(`[NEWSLETTER SKIPPED] ${sub.email} — Resend not configured`);
            await pgDb
              .update(newsletterSends)
              .set({ status: "failed", errorMessage: "Resend not configured", sentAt: new Date() })
              .where(eq(newsletterSends.id, inserted[0].id));
            failed += 1;
            continue;
          }

          // Capture Resend's message id so the email.opened / email.clicked
          // webhook events can be matched back to this exact send. Without
          // it, engagement webhooks have no way to find the row to stamp.
          const sendResult = await resend.emails.send({
            from: `${business.name} via Local List 365 <onboarding@resend.dev>`,
            to: [sub.email],
            subject: campaign.subject,
            html,
            headers: {
              "List-Unsubscribe": `<${unsubscribeUrl}>`,
              "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
            },
          });
          // The Resend SDK shape: { data: { id }, error }. Surface a non-2xx
          // as a thrown failure so the catch arm marks the row 'failed'
          // (otherwise we'd record a "successful" send for a 4xx response).
          if ((sendResult as any)?.error) {
            const errMsg = (sendResult as any).error?.message ?? "Resend rejected send";
            throw new Error(errMsg);
          }
          const messageId = (sendResult as any)?.data?.id ?? null;
          await pgDb
            .update(newsletterSends)
            .set({ status: "sent", sentAt: new Date(), messageId })
            .where(eq(newsletterSends.id, inserted[0].id));
          success += 1;
        } catch (err: any) {
          console.error(`[NEWSLETTER FAILED] ${sub.email}:`, err?.message);
          await pgDb
            .update(newsletterSends)
            .set({ status: "failed", errorMessage: String(err?.message ?? err).slice(0, 500), sentAt: new Date() })
            .where(and(
              eq(newsletterSends.campaignId, cid),
              eq(newsletterSends.subscriberId, sub.id),
            ));
          failed += 1;
        }
      }

      const [final] = await pgDb
        .update(newsletterCampaigns)
        .set({
          status: failed === subs.length ? "failed" : "sent",
          successCount: success,
          failureCount: failed,
          sentAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(newsletterCampaigns.id, cid))
        .returning();

      res.json({ campaign: final, sent: success, failed });
    },
  );

  // Public unsubscribe — token-based, no auth required.
  // Supports both GET (link click) and POST (one-click List-Unsubscribe).
  const handleUnsubscribe = async (req: Request, res: Response) => {
    const token = req.params.token;
    if (!token) return res.status(400).send("Invalid unsubscribe link.");
    const result = await pgDb
      .update(newsletterSubscribers)
      .set({ unsubscribedAt: new Date() })
      .where(eq(newsletterSubscribers.unsubscribeToken, token))
      .returning({ id: newsletterSubscribers.id, businessId: newsletterSubscribers.businessId });
    if (!result[0]) {
      return res
        .status(404)
        .send(`<html><body style="font-family:Arial;text-align:center;padding:40px;"><h2>Link not found</h2><p>This unsubscribe link is invalid or already used.</p></body></html>`);
    }
    if (req.method === "POST") return res.status(200).send("OK");
    const [biz] = await pgDb
      .select({ name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, result[0].businessId));
    res.status(200).send(`
      <html><body style="font-family:Arial,sans-serif;max-width:520px;margin:60px auto;padding:0 20px;text-align:center;">
        <h1 style="color:#0a4a82;">You're unsubscribed</h1>
        <p style="color:#555;font-size:15px;line-height:1.6;">
          You will no longer receive newsletter emails from <strong>${escapeHtml(biz?.name ?? "this business")}</strong>.
        </p>
        <p style="color:#888;font-size:13px;margin-top:30px;">
          Local List 365 — Your Moyock Community Directory
        </p>
      </body></html>
    `);
  };
  app.get("/api/newsletter/unsubscribe/:token", handleUnsubscribe);
  app.post("/api/newsletter/unsubscribe/:token", handleUnsubscribe);
}

/**
 * Hook for other modules to call when they create a quote_request or review,
 * so the subscriber list grows organically. Idempotent.
 */
export async function autoAddNewsletterSubscriber(opts: {
  businessId: number;
  email: string | null | undefined;
  name?: string | null;
  userId?: string | null;
  source: "quote_request" | "review";
}): Promise<void> {
  if (!opts.email) return;
  try {
    await upsertSubscriber({
      businessId: opts.businessId,
      email: opts.email,
      name: opts.name ?? null,
      userId: opts.userId ?? null,
      source: opts.source,
    });
  } catch (err: any) {
    console.error("[newsletter] autoAdd failed:", err?.message);
  }
}
