/**
 * Marketing Suite #5 — Review Request Blasts (Gold-only)
 *
 * Lets a Gold business owner ask past customers to leave a review, in bulk,
 * via email and/or SMS. The list of "eligible" customers is derived from
 * the same sources the newsletter uses (past quote requesters + reviewers).
 *
 * Each send writes a `review_requests` row with a click-tracked token. The
 * public click endpoint marks `clickedAt` and 302s the recipient to the
 * business detail page where they can drop a review.
 *
 * Rate limit: a customer cannot be re-asked within 90 days from the same
 * business. Enforced at SEND time by querying review_requests.
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
  reviewRequests,
  recipientSuppressions,
} from "@shared/schema";
import { quoteRequests } from "@shared/models/auth";
import { and, eq, sql, desc, or, gte, isNotNull } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";
import { normalizePhone } from "./sms";

const COOLDOWN_DAYS = 90;

function effectiveTier(b: {
  membershipTier: string | null;
  goldTrialEndDate: Date | null;
  isFoundingMember?: boolean | null;
}): string {
  if (b.isFoundingMember === true) return "premium";
  if (isCompActive(b)) return "premium";
  if (b.membershipTier === "premium") return "premium";
  if (b.goldTrialEndDate && new Date(b.goldTrialEndDate) > new Date()) return "premium";
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
      message: "Review Request Blasts require Gold membership.",
      code: "GOLD_REQUIRED",
    });
    return null;
  }
  return { business: biz };
}

function makeToken(): string {
  return crypto.randomBytes(20).toString("base64url");
}

function getBaseUrl(req: Request): string {
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "https";
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  return `${proto}://${host}`;
}

function toDateOrNull(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? null : v;
  const d = new Date(v as string | number);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface EligibleCustomer {
  key: string; // unique key: email or phone
  userId: string | null;
  email: string | null;
  phone: string | null;
  name: string | null;
  source: "quote_request" | "review";
  lastInteractionAt: Date | null;
  askedRecently: boolean;
  lastAskedAt: Date | null;
  suppressed: boolean;
  suppressionReason: string | null;
}

/**
 * Recognize Resend errors that mean "this address will never accept mail
 * again — stop trying." These come back from `resend.emails.send` either
 * as `invalid_to_address`/`validation_error` with messages mentioning
 * suppression or hard bounces. We deliberately match on a broad keyword
 * set so unknown future error codes still get suppressed if they look
 * permanent rather than burning more send attempts.
 */
function isPermanentEmailFailure(err: { name?: string | null; message?: string | null } | null | undefined): boolean {
  if (!err) return false;
  const blob = `${err.name ?? ""} ${err.message ?? ""}`.toLowerCase();
  return (
    blob.includes("suppress") ||
    blob.includes("bounce") ||
    blob.includes("invalid_to_address") ||
    blob.includes("invalid_recipient") ||
    blob.includes("invalid email") ||
    blob.includes("does not exist") ||
    blob.includes("no such user") ||
    blob.includes("user unknown") ||
    blob.includes("mailbox unavailable") ||
    blob.includes("mailbox does not exist") ||
    blob.includes("recipient address rejected") ||
    blob.includes("permanent")
  );
}

async function loadSuppressions(businessId: number): Promise<{
  emails: Map<string, string>;
  phones: Map<string, string>;
}> {
  const rows = await pgDb
    .select()
    .from(recipientSuppressions)
    .where(eq(recipientSuppressions.businessId, businessId));
  const emails = new Map<string, string>();
  const phones = new Map<string, string>();
  for (const r of rows) {
    if (r.contactType === "email") emails.set(r.contact.toLowerCase(), r.reason);
    else if (r.contactType === "phone") phones.set(r.contact, r.reason);
  }
  return { emails, phones };
}

async function recordSuppression(opts: {
  businessId: number;
  contactType: "email" | "phone";
  contact: string;
  reason: string;
}): Promise<boolean> {
  const contact = opts.contactType === "email" ? opts.contact.toLowerCase() : opts.contact;
  try {
    const inserted = await pgDb
      .insert(recipientSuppressions)
      .values({
        businessId: opts.businessId,
        contactType: opts.contactType,
        contact,
        reason: opts.reason.slice(0, 500),
      })
      .onConflictDoNothing()
      .returning({ id: recipientSuppressions.id });
    return inserted.length > 0;
  } catch (err: any) {
    console.error("[review-requests] failed to record suppression:", err?.message);
    return false;
  }
}

async function getEligibleCustomers(businessId: number): Promise<EligibleCustomer[]> {
  // Past quote requesters who actually got a quote from THIS business
  // (we look at quote_requests rows whose request received a quote from us OR
  // simpler: any quote_request whose customer_email is non-null and the
  // requester also has a quote from this business). For first version we
  // pull ALL quote_requests from users who quoted with this business.
  const fromQuotes = await pgDb.execute<{
    user_id: string | null;
    customer_email: string | null;
    customer_phone: string | null;
    customer_name: string | null;
    last_interaction: Date | null;
  }>(sql`
    SELECT DISTINCT ON (COALESCE(qr.customer_email, qr.customer_phone, qr.user_id))
      qr.user_id,
      qr.customer_email,
      qr.customer_phone,
      qr.customer_name,
      MAX(qr.created_at) OVER (PARTITION BY COALESCE(qr.customer_email, qr.customer_phone, qr.user_id)) AS last_interaction
    FROM quote_requests qr
    INNER JOIN quotes q ON q.request_id = qr.id
    WHERE q.business_id = ${businessId}
      AND (qr.customer_email IS NOT NULL OR qr.customer_phone IS NOT NULL)
  `);

  // Past reviewers (joined to users for email)
  const fromReviews = await pgDb
    .select({
      userId: reviews.userId,
      email: users.email,
      name: sql<string>`COALESCE(${users.firstName} || ' ' || ${users.lastName}, ${users.email})`,
      lastInteractionAt: sql<Date>`MAX(${reviews.createdAt})`,
    })
    .from(reviews)
    .innerJoin(users, eq(users.id, reviews.userId))
    .where(eq(reviews.businessId, businessId))
    .groupBy(reviews.userId, users.email, users.firstName, users.lastName);

  // Past review requests (for the cooldown check)
  const cooldownCutoff = new Date(Date.now() - COOLDOWN_DAYS * 24 * 60 * 60 * 1000);
  const recentAsks = await pgDb
    .select({
      email: reviewRequests.recipientEmail,
      phone: reviewRequests.recipientPhone,
      sentAt: reviewRequests.sentAt,
    })
    .from(reviewRequests)
    .where(and(
      eq(reviewRequests.businessId, businessId),
      isNotNull(reviewRequests.sentAt),
      gte(reviewRequests.sentAt, cooldownCutoff),
    ));
  const recentByEmail = new Map<string, Date>();
  const recentByPhone = new Map<string, Date>();
  for (const r of recentAsks) {
    if (r.email && r.sentAt) recentByEmail.set(r.email.toLowerCase(), r.sentAt);
    if (r.phone && r.sentAt) recentByPhone.set(r.phone, r.sentAt);
  }

  const suppressions = await loadSuppressions(businessId);

  const map = new Map<string, EligibleCustomer>();

  for (const row of fromQuotes.rows ?? []) {
    const email = row.customer_email?.toLowerCase().trim() || null;
    const phone = row.customer_phone ? normalizePhone(row.customer_phone) : null;
    const key = email ?? phone;
    if (!key) continue;
    const lastAskedAt = (email && recentByEmail.get(email)) || (phone && recentByPhone.get(phone)) || null;
    const suppReason =
      (email && suppressions.emails.get(email)) ||
      (phone && suppressions.phones.get(phone)) ||
      null;
    map.set(key, {
      key,
      userId: row.user_id,
      email,
      phone,
      name: row.customer_name ?? null,
      source: "quote_request",
      lastInteractionAt: toDateOrNull(row.last_interaction),
      askedRecently: !!lastAskedAt,
      lastAskedAt,
      suppressed: !!suppReason,
      suppressionReason: suppReason ?? null,
    });
  }

  for (const row of fromReviews) {
    const email = row.email?.toLowerCase().trim() || null;
    if (!email) continue;
    const key = email;
    if (map.has(key)) continue; // dedupe — quote_request takes precedence
    const lastAskedAt = recentByEmail.get(email) || null;
    const suppReason = suppressions.emails.get(email) || null;
    map.set(key, {
      key,
      userId: row.userId,
      email,
      phone: null,
      name: row.name,
      source: "review",
      lastInteractionAt: toDateOrNull(row.lastInteractionAt),
      askedRecently: !!lastAskedAt,
      lastAskedAt,
      suppressed: !!suppReason,
      suppressionReason: suppReason,
    });
  }

  return Array.from(map.values()).sort((a, b) => {
    const ta = toMs(a.lastInteractionAt);
    const tb = toMs(b.lastInteractionAt);
    return tb - ta;
  });
}

// Defensive timestamp coercion. node-postgres normally hydrates timestamps
// to Date, but some code paths (raw `pgDb.execute(sql\`…\`)`) and proxies
// can hand back a string instead. Calling `.getTime()` on a string crashed
// the eligible-customers list whenever it returned more than one row.
function toMs(v: Date | string | null | undefined): number {
  if (!v) return 0;
  if (v instanceof Date) return v.getTime();
  const t = new Date(v).getTime();
  return Number.isFinite(t) ? t : 0;
}

function buildEmailHtml(opts: {
  business: typeof businesses.$inferSelect;
  recipientName: string | null;
  ownerMessage: string;
  reviewUrl: string;
}): string {
  const { business, recipientName, ownerMessage, reviewUrl } = opts;
  const greet = recipientName ? `Hi ${escapeHtml(recipientName.split(" ")[0])},` : "Hi there,";
  const addressLine = [business.address, business.city, business.state, business.zipCode]
    .filter(Boolean)
    .join(", ");
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; color: #1a1a2e;">
      <div style="background: linear-gradient(135deg, #0a4a82, #0d5a9e); color: white; padding: 20px 24px; border-radius: 12px 12px 0 0;">
        <h1 style="margin: 0; font-size: 18px; font-weight: 600;">${escapeHtml(business.name)}</h1>
      </div>
      <div style="background: #ffffff; padding: 24px; border: 1px solid #e5e5e5; border-top: none;">
        <p style="margin: 0 0 12px; font-size: 15px; line-height: 1.6;">${greet}</p>
        <div style="font-size: 15px; line-height: 1.6; margin-bottom: 20px; white-space: pre-wrap;">${escapeHtml(ownerMessage)}</div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${reviewUrl}" style="display: inline-block; background: #d4a373; color: white; padding: 14px 36px; border-radius: 8px; text-decoration: none; font-weight: bold; font-size: 15px;">
            Leave a Review
          </a>
        </div>
        <p style="margin: 0; font-size: 13px; color: #666; text-align: center;">
          Thank you — your feedback helps neighbors find great local businesses.
        </p>
      </div>
      <div style="background: #f5f5f5; padding: 14px 24px; border: 1px solid #e5e5e5; border-top: none; border-radius: 0 0 12px 12px; font-size: 11px; color: #888; line-height: 1.5; text-align: center;">
        <p style="margin: 0 0 4px;">${escapeHtml(business.name)}${addressLine ? " · " + escapeHtml(addressLine) : ""}</p>
        <p style="margin: 0;">Sent through <a href="https://locallist365.replit.app" style="color: #0a4a82; text-decoration: none;">Local List 365</a></p>
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

const SendBodySchema = z.object({
  customerKeys: z.array(z.string().min(1)).min(1).max(500),
  channel: z.enum(["email", "sms", "both"]),
  emailSubject: z.string().min(2).max(200).optional(),
  emailBody: z.string().min(10).max(4000).optional(),
  smsBody: z.string().min(10).max(320).optional(),
});

export function registerReviewRequestRoutes(app: Express) {
  // List eligible customers (with cooldown flags)
  app.get(
    "/api/businesses/:id/review-requests/eligible",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      if (!Number.isFinite(businessId)) {
        return res.status(400).json({ message: "Invalid business id" });
      }
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      try {
        const customers = await getEligibleCustomers(businessId);
        res.json({ customers, cooldownDays: COOLDOWN_DAYS, total: customers.length });
      } catch (err: any) {
        console.error("[review-requests] eligible failed:", err?.message);
        res.status(500).json({ message: "Failed to load customers" });
      }
    },
  );

  // History (sent campaigns / individual asks)
  app.get(
    "/api/businesses/:id/review-requests",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      const rows = await pgDb
        .select()
        .from(reviewRequests)
        .where(eq(reviewRequests.businessId, businessId))
        .orderBy(desc(reviewRequests.createdAt))
        .limit(500);
      const summary = {
        total: rows.length,
        sent: rows.filter((r) => r.status === "sent" || r.status === "clicked" || r.status === "completed").length,
        clicked: rows.filter((r) => r.status === "clicked" || r.status === "completed").length,
        completed: rows.filter((r) => r.status === "completed").length,
        failed: rows.filter((r) => r.status === "failed").length,
      };
      res.json({ requests: rows, summary });
    },
  );

  // Send review-request blast (Gold required)
  app.post(
    "/api/businesses/:id/review-requests/send",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const auth = await authorizeOwner(req, res, businessId, true);
      if (!auth) return;
      const business = auth.business;

      const parsed = SendBodySchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({
          message: "Invalid input",
          errors: parsed.error.flatten(),
        });
      }
      const { customerKeys, channel, emailSubject, emailBody, smsBody } = parsed.data;

      if ((channel === "email" || channel === "both") && (!emailSubject || !emailBody)) {
        return res.status(400).json({ message: "Email subject and body are required for email channel" });
      }
      if ((channel === "sms" || channel === "both") && !smsBody) {
        return res.status(400).json({ message: "SMS body is required for SMS channel" });
      }

      const eligible = await getEligibleCustomers(businessId);
      const byKey = new Map(eligible.map((c) => [c.key, c]));
      const targets = customerKeys
        .map((k) => byKey.get(k))
        .filter((c): c is EligibleCustomer => !!c && !c.askedRecently);

      if (targets.length === 0) {
        return res.status(400).json({
          message: "No eligible recipients (all selected are within the 90-day cooldown)",
        });
      }

      const apiKey = process.env.RESEND_API_KEY;
      const resend = apiKey ? new Resend(apiKey) : null;
      const baseUrl = getBaseUrl(req);

      let success = 0;
      let failure = 0;
      let suppressedCount = 0;
      const skipped: string[] = [];
      const failures: Array<{
        key: string;
        name: string | null;
        contact: string | null;
        channel: "email" | "sms" | "both";
        errorMsg: string;
      }> = [];

      // Lazy import to avoid circular concerns
      const { sendBroadcastSms } = await import("./sms");

      // Load suppressions once for the whole blast so we don't even
      // attempt sends to addresses Resend has already rejected.
      const suppressions = await loadSuppressions(businessId);

      for (const c of targets) {
        const wantEmail = (channel === "email" || channel === "both") && !!c.email;
        const wantSms = (channel === "sms" || channel === "both") && !!c.phone;
        if (!wantEmail && !wantSms) {
          skipped.push(c.key);
          continue;
        }

        const emailSuppressed =
          wantEmail && c.email ? suppressions.emails.get(c.email.toLowerCase()) ?? null : null;
        const phoneSuppressed =
          wantSms && c.phone ? suppressions.phones.get(c.phone) ?? null : null;

        const token = makeToken();
        const reviewUrl = `${baseUrl}/api/r/${token}`;
        const [row] = await pgDb
          .insert(reviewRequests)
          .values({
            businessId,
            recipientUserId: c.userId,
            recipientEmail: wantEmail ? c.email : null,
            recipientPhone: wantSms ? c.phone : null,
            recipientName: c.name,
            channel,
            status: "queued",
            token,
          })
          .returning();

        let emailOk = !wantEmail;
        let smsOk = !wantSms;
        let lastErr: string | null = null;

        if (wantEmail && emailSuppressed) {
          // Don't waste a Resend call on a known-dead address. The
          // `email[suppressed]` marker tells the FE to render the
          // permanent-undeliverable hint and exclude the row from retry.
          lastErr = `email[suppressed]: previously marked permanently undeliverable — ${emailSuppressed}`;
        } else if (wantEmail && resend && c.email) {
          try {
            const result = await resend.emails.send({
              from: `${business.name} via Local List 365 <onboarding@resend.dev>`,
              to: [c.email],
              subject: emailSubject!,
              html: buildEmailHtml({
                business,
                recipientName: c.name,
                ownerMessage: emailBody!,
                reviewUrl,
              }),
            });
            // The Resend SDK does NOT throw on non-2xx or transport errors —
            // it returns { data, error }. If we don't inspect `error` here a
            // real Resend outage would silently mark every recipient 'sent'
            // and lock them out of the next 90-day cooldown without anyone
            // ever receiving an email.
            const sendError: { message?: string; name?: string } | null =
              result?.error ?? null;
            if (sendError) {
              const msg = sendError.message ?? sendError.name ?? "send failed";
              const permanent = isPermanentEmailFailure(sendError);
              lastErr = permanent
                ? `email[permanent]: ${sendError.name ? sendError.name + " — " : ""}${msg}`
                : `email: ${msg}`;
              console.error("[review-requests] email failed:", msg, permanent ? "(permanent)" : "");
              if (permanent && c.email) {
                await recordSuppression({
                  businessId,
                  contactType: "email",
                  contact: c.email,
                  reason: `${sendError.name ?? "resend_error"}: ${msg}`,
                });
              }
            } else {
              emailOk = true;
            }
          } catch (err: any) {
            const msg = err?.message ?? "send failed";
            const permanent = isPermanentEmailFailure({ message: msg, name: err?.name });
            lastErr = permanent ? `email[permanent]: ${msg}` : `email: ${msg}`;
            console.error("[review-requests] email failed:", msg);
            if (permanent && c.email) {
              await recordSuppression({
                businessId,
                contactType: "email",
                contact: c.email,
                reason: msg,
              });
            }
          }
        } else if (wantEmail && !resend) {
          lastErr = "email: RESEND_API_KEY not configured";
          console.warn("[review-requests] email skipped — Resend not configured");
        }

        if (wantSms && phoneSuppressed) {
          smsOk = false;
          lastErr = `sms[suppressed]: previously marked permanently undeliverable — ${phoneSuppressed}`;
        } else if (wantSms && c.phone) {
          try {
            const result = await sendBroadcastSms(c.phone, smsBody!, business.name, reviewUrl);
            if (result.success) smsOk = true;
            else {
              lastErr = `sms: ${result.errorMessage ?? result.errorCode ?? "send failed"}`;
            }
          } catch (err: any) {
            lastErr = `sms: ${err?.message ?? "send failed"}`;
          }
        }

        const ok = emailOk && smsOk;
        await pgDb
          .update(reviewRequests)
          .set({
            status: ok ? "sent" : "failed",
            sentAt: ok ? new Date() : null,
            errorMsg: ok ? null : lastErr,
          })
          .where(eq(reviewRequests.id, row.id));

        if (ok) {
          success++;
        } else {
          failure++;
          if (
            lastErr &&
            (lastErr.startsWith("email[suppressed]") || lastErr.startsWith("sms[suppressed]"))
          ) {
            suppressedCount++;
          }
          failures.push({
            key: c.key,
            name: c.name,
            contact: c.email ?? c.phone ?? null,
            channel,
            errorMsg: lastErr ?? "send failed",
          });
        }
      }

      res.json({
        ok: true,
        success,
        failure,
        skipped: skipped.length,
        cooldownExcluded: customerKeys.length - targets.length - skipped.length,
        suppressed: suppressedCount,
        failures,
      });
    },
  );

  // List recent webhook-driven auto-suppressions (Resend bounces / spam
  // complaints) for this business. Powers the "Recently auto-suppressed"
  // panel — gives owners a single place to see what bounced lately and
  // why, instead of scanning individual review_requests rows.
  app.get(
    "/api/businesses/:id/review-requests/recent-bounces",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      if (!Number.isFinite(businessId)) {
        return res.status(400).json({ message: "Invalid business id" });
      }
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      try {
        const LIMIT = 50;
        const whereExpr = and(
          eq(recipientSuppressions.businessId, businessId),
          sql`${recipientSuppressions.reason} LIKE 'webhook:%'`,
        );
        const rows = await pgDb
          .select()
          .from(recipientSuppressions)
          .where(whereExpr)
          .orderBy(desc(recipientSuppressions.createdAt))
          .limit(LIMIT);
        const [countRow] = await pgDb
          .select({
            total: sql<number>`COUNT(*)::int`,
            last7: sql<number>`COUNT(*) FILTER (WHERE ${recipientSuppressions.createdAt} >= NOW() - INTERVAL '7 days')::int`,
            last30: sql<number>`COUNT(*) FILTER (WHERE ${recipientSuppressions.createdAt} >= NOW() - INTERVAL '30 days')::int`,
          })
          .from(recipientSuppressions)
          .where(whereExpr);
        const total = Number(countRow?.total ?? rows.length);
        const last7Days = Number(countRow?.last7 ?? 0);
        const last30Days = Number(countRow?.last30 ?? 0);
        res.json({
          bounces: rows,
          total,
          last7Days,
          last30Days,
          hasMore: total > rows.length,
        });
      } catch (err: any) {
        console.error("[review-requests] recent-bounces failed:", err?.message);
        res.status(500).json({ message: "Failed to load recent bounces" });
      }
    },
  );

  // Bulk clear all webhook-recorded suppressions for this business. Used by
  // the "Clear all webhook bounces" button in the auto-suppressed panel so
  // owners can wipe a noisy list in one click after fixing addresses /
  // discovering a campaign that targeted bad contacts. Scoped to
  // reason LIKE 'webhook:%' — manual / non-webhook suppressions are left
  // alone so we don't accidentally undo intentional opt-outs.
  app.post(
    "/api/businesses/:id/review-requests/suppressions/clear-webhook-bounces",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      if (!Number.isFinite(businessId)) {
        return res.status(400).json({ message: "Invalid business id" });
      }
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      try {
        const result = await pgDb
          .delete(recipientSuppressions)
          .where(
            and(
              eq(recipientSuppressions.businessId, businessId),
              sql`${recipientSuppressions.reason} LIKE 'webhook:%'`,
            ),
          )
          .returning({ id: recipientSuppressions.id });
        res.json({ ok: true, cleared: result.length });
      } catch (err: any) {
        console.error("[review-requests] bulk clear webhook bounces failed:", err?.message);
        res.status(500).json({ message: "Failed to clear webhook bounces" });
      }
    },
  );

  // Clear a suppression so the owner can retry after fixing the address.
  // Body: { contactType: 'email' | 'phone', contact: string }
  app.post(
    "/api/businesses/:id/review-requests/suppressions/clear",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      if (!Number.isFinite(businessId)) {
        return res.status(400).json({ message: "Invalid business id" });
      }
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      const schema = z.object({
        contactType: z.enum(["email", "phone"]),
        contact: z.string().min(1).max(320),
      });
      const parsed = schema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const contact =
        parsed.data.contactType === "email"
          ? parsed.data.contact.toLowerCase().trim()
          : parsed.data.contact.trim();
      const result = await pgDb
        .delete(recipientSuppressions)
        .where(
          and(
            eq(recipientSuppressions.businessId, businessId),
            eq(recipientSuppressions.contactType, parsed.data.contactType),
            eq(recipientSuppressions.contact, contact),
          ),
        )
        .returning({ id: recipientSuppressions.id });
      res.json({ ok: true, cleared: result.length });
    },
  );

  // ──────────────────────────────────────────────────────────────────
  // Resend webhook — auto-suppress addresses Resend reports as bouncing
  // asynchronously (after our send call already returned 200 OK). Many
  // real bounces don't surface synchronously; without listening here the
  // same dead address slips through on the next blast and dings sender
  // reputation. Signature verification is REQUIRED (svix-compatible
  // headers — Resend signs webhooks with the same scheme as Svix).
  //
  // Event types we act on:
  //   - email.bounced   (only when bounce.type indicates a HARD/permanent
  //                      bounce; transient bounces are ignored)
  //   - email.complained (always treated as permanent — recipient marked
  //                       us as spam, never send to them again)
  //
  // For each suppressed (businessId, email) pair we:
  //   1. Insert into recipient_suppressions (per-business scope; one
  //      tenant's bounce never leaks into another tenant's eligibility).
  //   2. Flip the most recent non-terminal review_requests row for that
  //      (business, email) to status='failed' with an `email[permanent]:`
  //      errorMsg so the existing FE classifier renders the right hint.
  // ──────────────────────────────────────────────────────────────────
  app.post("/api/webhooks/resend", async (req, res) => {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      console.error("[resend-webhook] RESEND_WEBHOOK_SECRET is not configured — rejecting webhook");
      return res.status(503).json({ message: "Webhook not configured" });
    }
    const rawBody = (req as any).rawBody as Buffer | string | undefined;
    if (!rawBody) {
      return res.status(400).json({ message: "Missing raw body" });
    }
    const payload = Buffer.isBuffer(rawBody) ? rawBody.toString("utf8") : rawBody;

    let event: any;
    try {
      const { Webhook } = await import("svix");
      const wh = new Webhook(secret);
      event = wh.verify(payload, {
        "svix-id": String(req.headers["svix-id"] ?? ""),
        "svix-timestamp": String(req.headers["svix-timestamp"] ?? ""),
        "svix-signature": String(req.headers["svix-signature"] ?? ""),
      });
    } catch (err: any) {
      console.error("[resend-webhook] signature verification failed:", err?.message);
      return res.status(401).json({ message: "Invalid signature" });
    }

    const type: string = event?.type ?? "";
    const data: any = event?.data ?? {};
    const recipients: string[] = Array.isArray(data.to)
      ? data.to.filter((x: unknown): x is string => typeof x === "string")
      : typeof data.to === "string"
      ? [data.to]
      : [];

    let permanent = false;
    let reason = "";
    if (type === "email.bounced") {
      const bounceType = String(data?.bounce?.type ?? data?.bounce_type ?? "").toLowerCase();
      const bounceSub = String(data?.bounce?.subType ?? data?.bounce_subtype ?? "");
      // Resend / SES classify hard bounces as "Permanent" or "hard"; soft
      // bounces ("Transient", "Undetermined") are ignored — they may
      // recover on retry and we don't want to suppress on a tempfail.
      permanent = bounceType.includes("hard") || bounceType.includes("permanent");
      const msg = data?.bounce?.message ?? bounceSub ?? "hard bounce";
      reason = `bounced[${data?.bounce?.type ?? bounceType ?? "unknown"}]: ${msg}`;
    } else if (type === "email.complained") {
      permanent = true;
      reason = "complained: recipient reported as spam";
    } else {
      // Delivery / opened / clicked / etc — acknowledge so Resend stops
      // retrying, but do nothing.
      return res.json({ ok: true, ignored: type || "unknown" });
    }

    if (!permanent || recipients.length === 0) {
      return res.json({ ok: true, ignored: true, type });
    }

    let suppressedCount = 0;
    let updatedRequests = 0;

    for (const rawAddr of recipients) {
      const email = String(rawAddr).toLowerCase().trim();
      if (!email) continue;
      const rows = await pgDb
        .select({
          id: reviewRequests.id,
          businessId: reviewRequests.businessId,
          status: reviewRequests.status,
          sentAt: reviewRequests.sentAt,
          createdAt: reviewRequests.createdAt,
        })
        .from(reviewRequests)
        .where(sql`LOWER(${reviewRequests.recipientEmail}) = ${email}`);
      if (rows.length === 0) {
        // We never sent to this address from any business — record nothing.
        // (Could happen for cross-product Resend tenants sharing a webhook.)
        continue;
      }
      const businessIds = Array.from(new Set<number>(rows.map((r) => r.businessId)));
      for (const businessId of businessIds) {
        const newlySuppressed = await recordSuppression({
          businessId,
          contactType: "email",
          contact: email,
          reason: `webhook: ${reason}`,
        });
        if (newlySuppressed) suppressedCount++;
        // Pick the most recent non-terminal row for this business — that's
        // the send the bounce most likely relates to. We deliberately leave
        // 'clicked' and 'completed' rows alone; those represent successful
        // human engagement and shouldn't be retroactively rewritten.
        const candidates = rows
          .filter(
            (r) =>
              r.businessId === businessId &&
              (r.status === "sent" || r.status === "queued"),
          )
          .sort((a, b) => toMs(b.sentAt ?? b.createdAt) - toMs(a.sentAt ?? a.createdAt));
        const target = candidates[0];
        if (target) {
          await pgDb
            .update(reviewRequests)
            .set({
              status: "failed",
              errorMsg: `email[permanent]: ${reason}`,
            })
            .where(eq(reviewRequests.id, target.id));
          updatedRequests++;
        }
      }
    }

    res.json({
      ok: true,
      type,
      suppressed: suppressedCount,
      updated: updatedRequests,
    });
  });

  // Public click tracker — marks clicked, redirects to business page
  app.get("/api/r/:token", async (req, res) => {
    const token = String(req.params.token || "");
    if (!token) return res.status(400).send("Invalid link.");
    const [row] = await pgDb
      .select({
        id: reviewRequests.id,
        businessId: reviewRequests.businessId,
        clickedAt: reviewRequests.clickedAt,
      })
      .from(reviewRequests)
      .where(eq(reviewRequests.token, token));
    if (!row) {
      return res.status(404).send(`<html><body style="font-family:Arial;text-align:center;padding:60px;"><h2>Link not found</h2><p>This review link is invalid or expired.</p></body></html>`);
    }
    if (!row.clickedAt) {
      await pgDb
        .update(reviewRequests)
        .set({ clickedAt: new Date(), status: "clicked" })
        .where(eq(reviewRequests.id, row.id));
    }
    const baseUrl = getBaseUrl(req);
    // Forward the request token so the review form can (a) auto-open and
    // (b) attach `reviewRequestToken` on submit, which lets us mark this
    // outreach as "Reviewed" in the owner's funnel history.
    res.redirect(
      302,
      `${baseUrl}/directory/${row.businessId}?reviewToken=${encodeURIComponent(token)}#leave-review`,
    );
  });
}
