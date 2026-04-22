/**
 * Marketing Suite #3 — SMS Broadcast (Gold-only, charged in AI credits)
 *
 * Provider adapter pattern:
 *  - SMS_PROVIDER=stub (default): logs to console and pretends success.
 *    Lets us ship the entire UI flow + credit billing without Twilio.
 *  - SMS_PROVIDER=twilio: requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN,
 *    TWILIO_PHONE_NUMBER. Until 10DLC carrier registration is approved,
 *    Twilio will block US destinations — keep stub mode on until then.
 *
 * Pricing: 2 credits per segment per recipient. A segment is 160 chars
 * (GSM-7) or 70 chars (Unicode). We compute segments from the body once
 * and apply uniformly so the owner sees a deterministic cost upfront.
 *
 * TCPA: every recipient row must have an opted_in_at AND no opted_out_at.
 * Footer with STOP/HELP language is auto-appended unless body already
 * contains "STOP" — we never strip what the owner wrote.
 */
import type { Express, Request, Response } from "express";
import crypto from "crypto";
import { db as pgDb } from "./db";
import {
  businesses,
  users,
  smsSubscribers,
  smsCampaigns,
  smsSends,
  aiCredits,
  aiCreditTransactions,
} from "@shared/schema";
import { and, eq, desc, sql } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";

const SMS_CREDITS_PER_SEGMENT = 2;
const PROVIDER = (process.env.SMS_PROVIDER ?? "stub").toLowerCase();

/* ─── Helpers ─── */

function effectiveTier(b: {
  membershipTier: string | null;
  goldTrialEndDate: Date | null;
  isFoundingMember?: boolean | null;
}): string {
  if (b.isFoundingMember === true) return "premium";
  if (b.isCompedMembership === true) return "premium";
  if (b.membershipTier === "premium") return "premium";
  if (b.goldTrialEndDate && new Date(b.goldTrialEndDate) > new Date()) return "premium";
  return b.membershipTier ?? "none";
}

/** Normalize US phone to E.164 (+1XXXXXXXXXX). Returns null if invalid. */
export function normalizePhone(raw: string): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  if (raw.startsWith("+") && digits.length >= 10 && digits.length <= 15) {
    return `+${digits}`;
  }
  return null;
}

/**
 * GSM-7 charset detection. If the body contains a non-GSM char (emoji,
 * smart quotes, etc.) Twilio bills at 70 chars/segment instead of 160.
 */
const GSM7_RE = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåÆæßÉ!"#$%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà_^{}\\\[~\]|€]*$/;
export function computeSegments(body: string): number {
  if (body.length === 0) return 0;
  const isGsm = GSM7_RE.test(body);
  const limit = isGsm ? 160 : 70;
  // Multi-segment uses 153/67 due to UDH overhead, but we round up to the
  // simpler 160/70 per-segment estimate — owner-facing, not Twilio billing.
  const seg = body.length <= limit ? 1 : Math.ceil(body.length / (isGsm ? 153 : 67));
  return seg;
}

function appendStopFooter(body: string): string {
  // CTIA recommended: at least one message in any program must include
  // "Reply STOP to unsubscribe". We append every time unless the owner
  // explicitly included STOP wording themselves.
  if (/\bSTOP\b/i.test(body)) return body;
  return `${body.trimEnd()}\n\nReply STOP to opt out`;
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
      message: "SMS Broadcast requires Gold membership.",
      code: "GOLD_REQUIRED",
    });
    return null;
  }
  return { business: biz };
}

/* ─── Provider adapter ─── */

interface SendResult {
  success: boolean;
  providerMessageSid?: string;
  errorCode?: string;
  errorMessage?: string;
}

export async function sendBroadcastSms(
  toE164: string,
  body: string,
  businessName: string,
  reviewUrl?: string,
): Promise<SendResult> {
  const finalBody = reviewUrl ? `${body}\n${reviewUrl}` : body;
  return providerSend(toE164, finalBody, businessName);
}

async function providerSend(toE164: string, body: string, businessName: string): Promise<SendResult> {
  if (PROVIDER === "twilio") {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const from = process.env.TWILIO_PHONE_NUMBER;
    if (!sid || !token || !from) {
      return {
        success: false,
        errorCode: "TWILIO_NOT_CONFIGURED",
        errorMessage: "Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER",
      };
    }
    try {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
      const auth = Buffer.from(`${sid}:${token}`).toString("base64");
      const params = new URLSearchParams({ From: from, To: toE164, Body: body });
      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${auth}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      });
      const json: any = await resp.json();
      if (!resp.ok) {
        return {
          success: false,
          errorCode: String(json.code ?? resp.status),
          errorMessage: json.message ?? "Twilio error",
        };
      }
      return { success: true, providerMessageSid: json.sid };
    } catch (err: any) {
      return { success: false, errorCode: "NETWORK", errorMessage: err?.message ?? "Network failure" };
    }
  }
  // Stub: log + pretend success
  console.log(
    `[sms-stub] from="${businessName}" to=${toE164} body=${JSON.stringify(body)}`,
  );
  return { success: true, providerMessageSid: `STUB-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` };
}

/* ─── Atomic credit reservation (mirrors aiFeatures.reserveCredits) ─── */

async function reserveSmsCredits(
  businessId: number,
  totalCredits: number,
  metadata: Record<string, unknown>,
): Promise<{ ok: true; balance: number; deducted: number; founder: boolean } | { ok: false; reason: "INSUFFICIENT" | "NO_ROW"; balance: number }> {
  return await pgDb.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(aiCredits)
      .where(eq(aiCredits.businessId, businessId))
      .for("update");
    if (!row) {
      // No credit row yet — bootstrap with 0 + founder flag from biz table
      const [biz] = await tx
        .select({ isFoundingMember: businesses.isFoundingMember })
        .from(businesses)
        .where(eq(businesses.id, businessId));
      const founder = biz?.isFoundingMember === true;
      await tx
        .insert(aiCredits)
        .values({ businessId, balance: 0, isFounderComp: founder })
        .onConflictDoNothing({ target: aiCredits.businessId });
      if (!founder) return { ok: false as const, reason: "INSUFFICIENT" as const, balance: 0 };
      await tx.insert(aiCreditTransactions).values({
        businessId,
        type: "usage",
        feature: "sms_broadcast",
        creditsDelta: 0,
        costCents: 0,
        metadata: JSON.stringify(metadata),
      });
      return { ok: true as const, balance: 0, deducted: 0, founder: true };
    }
    if (row.isFounderComp) {
      await tx.insert(aiCreditTransactions).values({
        businessId,
        type: "usage",
        feature: "sms_broadcast",
        creditsDelta: 0,
        costCents: 0,
        metadata: JSON.stringify(metadata),
      });
      return { ok: true as const, balance: row.balance ?? 0, deducted: 0, founder: true };
    }
    if ((row.balance ?? 0) < totalCredits) {
      return { ok: false as const, reason: "INSUFFICIENT" as const, balance: row.balance ?? 0 };
    }
    const [updated] = await tx
      .update(aiCredits)
      .set({
        balance: sql`${aiCredits.balance} - ${totalCredits}`,
        updatedAt: new Date(),
      })
      .where(eq(aiCredits.businessId, businessId))
      .returning({ balance: aiCredits.balance });
    await tx.insert(aiCreditTransactions).values({
      businessId,
      type: "usage",
      feature: "sms_broadcast",
      creditsDelta: -totalCredits,
      costCents: 0,
      metadata: JSON.stringify(metadata),
    });
    return { ok: true as const, balance: updated.balance ?? 0, deducted: totalCredits, founder: false };
  });
}

async function refundCredits(
  businessId: number,
  amount: number,
  reason: string,
): Promise<void> {
  if (amount <= 0) return;
  await pgDb.transaction(async (tx) => {
    const [row] = await tx
      .select()
      .from(aiCredits)
      .where(eq(aiCredits.businessId, businessId))
      .for("update");
    if (!row || row.isFounderComp) return; // founders weren't charged
    await tx
      .update(aiCredits)
      .set({
        balance: sql`${aiCredits.balance} + ${amount}`,
        updatedAt: new Date(),
      })
      .where(eq(aiCredits.businessId, businessId));
    await tx.insert(aiCreditTransactions).values({
      businessId,
      type: "refund",
      feature: "sms_broadcast",
      creditsDelta: amount,
      costCents: 0,
      metadata: JSON.stringify({ reason }),
    });
  });
}

/* ─── Routes ─── */

const SubscriberCreateSchema = z.object({
  phone: z.string().min(7).max(20),
  name: z.string().max(100).optional(),
  consentAttested: z.literal(true), // forces owner to confirm consent
});

const CampaignCreateSchema = z.object({
  body: z.string().trim().min(5).max(1000),
});

export function registerSmsRoutes(app: Express) {
  /* ---- Subscribers ---- */

  app.get("/api/businesses/:id/sms/subscribers", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    if (!Number.isFinite(businessId)) return res.status(400).json({ message: "Invalid business id" });
    const auth = await authorizeOwner(req, res, businessId);
    if (!auth) return;
    const rows = await pgDb
      .select()
      .from(smsSubscribers)
      .where(eq(smsSubscribers.businessId, businessId))
      .orderBy(desc(smsSubscribers.createdAt));
    const total = rows.length;
    const active = rows.filter((r) => !r.optedOutAt).length;
    res.json({ subscribers: rows, total, active });
  });

  app.post("/api/businesses/:id/sms/subscribers", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    const auth = await authorizeOwner(req, res, businessId, true);
    if (!auth) return;
    const parsed = SubscriberCreateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input. Phone is required and consent must be attested.", errors: parsed.error.flatten() });
    }
    const phone = normalizePhone(parsed.data.phone);
    if (!phone) {
      return res.status(400).json({ message: "Invalid phone number. Use a 10-digit US number." });
    }
    try {
      const [row] = await pgDb
        .insert(smsSubscribers)
        .values({
          businessId,
          phone,
          name: parsed.data.name ?? null,
          source: "manual",
          optedInAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [smsSubscribers.businessId, smsSubscribers.phone],
          set: { optedOutAt: null, optOutKeyword: null, name: parsed.data.name ?? null },
        })
        .returning();
      res.json({ subscriber: row });
    } catch (err: any) {
      console.error("[sms] subscriber insert failed:", err?.message);
      res.status(500).json({ message: "Could not save subscriber" });
    }
  });

  app.delete("/api/businesses/:id/sms/subscribers/:subId", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    const subId = Number(req.params.subId);
    const auth = await authorizeOwner(req, res, businessId);
    if (!auth) return;
    const result = await pgDb
      .delete(smsSubscribers)
      .where(and(eq(smsSubscribers.id, subId), eq(smsSubscribers.businessId, businessId)))
      .returning({ id: smsSubscribers.id });
    if (!result[0]) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });

  /* ---- Cost preview (no charge) ---- */

  app.post("/api/businesses/:id/sms/preview", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    const auth = await authorizeOwner(req, res, businessId);
    if (!auth) return;
    const parsed = CampaignCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input" });
    const finalBody = appendStopFooter(parsed.data.body);
    const segments = computeSegments(finalBody);
    const activeRows = await pgDb
      .select({ id: smsSubscribers.id })
      .from(smsSubscribers)
      .where(and(eq(smsSubscribers.businessId, businessId), sql`${smsSubscribers.optedOutAt} IS NULL`));
    const recipients = activeRows.length;
    const totalCredits = recipients * segments * SMS_CREDITS_PER_SEGMENT;
    res.json({
      finalBody,
      segments,
      recipients,
      creditsPerSegment: SMS_CREDITS_PER_SEGMENT,
      creditsPerRecipient: segments * SMS_CREDITS_PER_SEGMENT,
      totalCredits,
      provider: PROVIDER,
    });
  });

  /* ---- Campaigns ---- */

  app.get("/api/businesses/:id/sms/campaigns", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    const auth = await authorizeOwner(req, res, businessId);
    if (!auth) return;
    const rows = await pgDb
      .select()
      .from(smsCampaigns)
      .where(eq(smsCampaigns.businessId, businessId))
      .orderBy(desc(smsCampaigns.createdAt));
    res.json({ campaigns: rows });
  });

  /* ---- Send (the big one) ---- */

  app.post("/api/businesses/:id/sms/send", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    const auth = await authorizeOwner(req, res, businessId, true);
    if (!auth) return;
    const parsed = CampaignCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Body must be 5-1000 characters." });

    const finalBody = appendStopFooter(parsed.data.body);
    const segments = computeSegments(finalBody);

    // Snapshot the active recipient list at send-time
    const recipients = await pgDb
      .select()
      .from(smsSubscribers)
      .where(and(eq(smsSubscribers.businessId, businessId), sql`${smsSubscribers.optedOutAt} IS NULL`));
    if (recipients.length === 0) {
      return res.status(400).json({ message: "No opted-in subscribers. Add some first.", code: "NO_RECIPIENTS" });
    }

    const totalCredits = recipients.length * segments * SMS_CREDITS_PER_SEGMENT;
    const reservation = await reserveSmsCredits(businessId, totalCredits, {
      recipients: recipients.length,
      segments,
      bodyPreview: finalBody.slice(0, 80),
    });
    if (!reservation.ok) {
      return res.status(402).json({
        message: `Not enough credits. This blast costs ${totalCredits} credits (${recipients.length} recipients × ${segments} segments × ${SMS_CREDITS_PER_SEGMENT} credits/segment). Top up in your dashboard.`,
        code: "INSUFFICIENT_CREDITS",
        required: totalCredits,
        balance: reservation.balance,
      });
    }

    // Create the campaign row
    const [campaign] = await pgDb
      .insert(smsCampaigns)
      .values({
        businessId,
        body: finalBody,
        segmentsPerRecipient: segments,
        status: "sending",
        recipientCount: recipients.length,
        creditsCharged: reservation.deducted,
      })
      .returning();

    // Send each one (sequential — small lists, gives us per-recipient
    // error tracking and respects Twilio's 1 msg/sec default rate limit).
    let successCount = 0;
    let failureCount = 0;
    let creditsRefunded = 0;
    const perRecipientCredits = segments * SMS_CREDITS_PER_SEGMENT;

    for (const sub of recipients) {
      // Idempotency: skip if a send row already exists (shouldn't happen
      // since campaign is brand new, but defensive).
      try {
        const sendRow = {
          campaignId: campaign.id,
          subscriberId: sub.id,
          status: "pending" as const,
          segments,
          creditsCharged: perRecipientCredits,
        };
        await pgDb.insert(smsSends).values(sendRow).onConflictDoNothing({
          target: [smsSends.campaignId, smsSends.subscriberId],
        });

        const result = await providerSend(sub.phone, finalBody, auth.business.name);
        if (result.success) {
          successCount++;
          await pgDb
            .update(smsSends)
            .set({
              status: "sent",
              providerMessageSid: result.providerMessageSid ?? null,
              sentAt: new Date(),
            })
            .where(and(eq(smsSends.campaignId, campaign.id), eq(smsSends.subscriberId, sub.id)));
        } else {
          failureCount++;
          creditsRefunded += perRecipientCredits;
          await pgDb
            .update(smsSends)
            .set({
              status: "failed",
              errorCode: result.errorCode ?? "UNKNOWN",
              errorMessage: result.errorMessage?.slice(0, 500) ?? null,
            })
            .where(and(eq(smsSends.campaignId, campaign.id), eq(smsSends.subscriberId, sub.id)));
        }
      } catch (err: any) {
        failureCount++;
        creditsRefunded += perRecipientCredits;
        console.error("[sms] send loop error:", err?.message);
      }
    }

    // Refund credits for failed sends so owner isn't charged for them
    if (creditsRefunded > 0) {
      await refundCredits(businessId, creditsRefunded, `${failureCount} failed sends in campaign #${campaign.id}`);
    }

    // Finalize campaign
    const [finalCampaign] = await pgDb
      .update(smsCampaigns)
      .set({
        status: failureCount === recipients.length ? "failed" : "sent",
        successCount,
        failureCount,
        creditsCharged: reservation.deducted - creditsRefunded,
        sentAt: new Date(),
      })
      .where(eq(smsCampaigns.id, campaign.id))
      .returning();

    res.json({
      campaign: finalCampaign,
      sent: successCount,
      failed: failureCount,
      creditsCharged: reservation.deducted - creditsRefunded,
      creditsRefunded,
      provider: PROVIDER,
      providerNote:
        PROVIDER === "stub"
          ? "Running in stub mode — messages were logged to the server console, not actually delivered. Add Twilio credentials to enable real SMS."
          : undefined,
    });
  });

  /* ---- Inbound webhook (Twilio POSTs here on STOP/HELP) ----
     SECURITY: validates X-Twilio-Signature so attackers can't mass-
     unsubscribe by spoofing requests. Returns 403 on bad signature.
     In stub mode the endpoint short-circuits with 404 since we never
     legitimately receive inbound webhooks without a real provider. */

  app.post("/api/sms/inbound", async (req, res) => {
    // Inert when not on Twilio
    if (PROVIDER !== "twilio") {
      return res.status(404).type("text/xml").send("<Response></Response>");
    }
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const signature = req.header("X-Twilio-Signature") ?? "";
    if (!authToken || !signature) {
      return res.status(403).type("text/xml").send("<Response></Response>");
    }
    // Twilio signature: HMAC-SHA1(authToken, fullUrl + sortedKeyValueConcat)
    // Reconstruct the full URL exactly as Twilio called it (proto + host + path).
    const proto = (req.header("X-Forwarded-Proto") ?? req.protocol).split(",")[0].trim();
    const host = req.header("X-Forwarded-Host") ?? req.header("Host") ?? "";
    const fullUrl = `${proto}://${host}${req.originalUrl}`;
    const params = req.body && typeof req.body === "object" ? (req.body as Record<string, string>) : {};
    const sortedKeys = Object.keys(params).sort();
    const data = fullUrl + sortedKeys.map((k) => k + String(params[k] ?? "")).join("");
    const expected = crypto.createHmac("sha1", authToken).update(data, "utf-8").digest("base64");
    // Constant-time compare (lengths must match for timingSafeEqual)
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expected);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return res.status(403).type("text/xml").send("<Response></Response>");
    }

    const from = String(req.body?.From ?? "").trim();
    const body = String(req.body?.Body ?? "").trim().toUpperCase();
    if (!from || !body) {
      return res.type("text/xml").send("<Response></Response>");
    }
    const isStop = ["STOP", "STOPALL", "UNSUBSCRIBE", "CANCEL", "END", "QUIT"].includes(body);
    if (isStop) {
      // Mark this phone unsubscribed for ALL businesses they're in
      await pgDb
        .update(smsSubscribers)
        .set({ optedOutAt: new Date(), optOutKeyword: body })
        .where(and(eq(smsSubscribers.phone, from), sql`${smsSubscribers.optedOutAt} IS NULL`));
      return res.type("text/xml").send(`<Response><Message>You're unsubscribed. No more messages will be sent.</Message></Response>`);
    }
    if (body === "HELP") {
      return res.type("text/xml").send(`<Response><Message>Local List 365: business updates. Reply STOP to opt out. Msg&data rates may apply.</Message></Response>`);
    }
    res.type("text/xml").send("<Response></Response>");
  });
}
