/**
 * AI Suite Phase 1B — first customer-facing features.
 *
 * Wires the Phase 1A credit ledger (server/aiLab.ts) to actual AI workloads
 * that owners run from their dashboard. Each feature:
 *   1. Verifies the caller owns the business and is on Gold (or founder).
 *   2. Atomically deducts credits + writes a `usage` ledger row in one tx.
 *      Insufficient balance returns 402 BEFORE any OpenAI call is made.
 *   3. Hits OpenAI via the existing AI Integrations proxy.
 *   4. Refunds nothing on AI failure — the cost has already been incurred
 *      against our OpenAI bill, so the credit deduction is "real". (We log
 *      the failure so admin can manually credit-back if it's our fault.)
 */
import type { Express, Request, Response, NextFunction } from "express";
import OpenAI from "openai";
import { db as pgDb } from "./db";
import {
  aiCredits,
  aiCreditTransactions,
  businesses,
  reviews,
  users,
} from "@shared/schema";
import { and, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";

const FOUNDER_NAMES = new Set([
  "goat locker printing",
  "blackwater technology solutions",
]);
function isFounderName(name: string | null | undefined): boolean {
  return !!name && FOUNDER_NAMES.has(name.trim().toLowerCase());
}

/* Request + AI response schemas (runtime-validated) */
const ListingFactsSchema = z.object({
  services: z.string().max(500).optional(),
  yearsInBusiness: z.union([z.string().max(20), z.number()]).optional(),
  uniqueValueProps: z.string().max(500).optional(),
  tone: z.enum(["professional", "friendly", "luxury", "casual"]).optional(),
});
const ListingRequestSchema = z.object({
  businessId: z.number().int().positive(),
  facts: ListingFactsSchema.optional().default({}),
});
const AiVariantSchema = z.object({
  label: z.string().min(1).max(60),
  text: z.string().min(20).max(1200),
});
const AiResponseSchema = z.object({
  variants: z.array(AiVariantSchema).length(3),
});

/**
 * Mirror of the routes.ts/stripe.ts effective-tier helper. Treats a business
 * as Gold during its 30-day Gold-trial window even if `membershipTier` is
 * Bronze/Silver. Founders are always Gold-equivalent for AI access.
 */
function effectiveTier(b: {
  membershipTier: string | null;
  goldTrialEndDate: Date | null;
  name?: string | null;
}): string {
  if (isFounderName(b.name)) return "premium";
  if (b.membershipTier === "premium") return "premium";
  if (b.goldTrialEndDate && new Date(b.goldTrialEndDate) > new Date()) {
    return "premium";
  }
  return b.membershipTier ?? "none";
}

/**
 * Loads the business AND verifies the caller owns it (via users.linkedBusinessId)
 * AND that they have Gold-tier access (real or trial or founder). Mirrors the
 * pattern used by other owner-only routes in routes.ts.
 */
async function authorizeOwnerOnGold(
  req: Request,
  res: Response,
  businessId: number,
): Promise<{ business: typeof businesses.$inferSelect } | null> {
  const userId = (req as any).user?.id;
  if (!userId) {
    res.status(401).json({ message: "Unauthorized" });
    return null;
  }
  const [user] = await pgDb
    .select({
      id: users.id,
      accountType: users.accountType,
      linkedBusinessId: users.linkedBusinessId,
    })
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
  // Owner-only: admins must use the admin AI Lab endpoints, not the
  // customer-facing feature routes (prevents accidental admin spend on
  // someone else's business and keeps the audit trail clean).
  if (user.linkedBusinessId !== biz.id) {
    res.status(403).json({ message: "You don't own this business" });
    return null;
  }
  if (effectiveTier(biz) !== "premium") {
    res.status(403).json({
      message: "AI features are available on Gold membership.",
      code: "GOLD_REQUIRED",
    });
    return null;
  }
  return { business: biz };
}

/**
 * Atomically reserve credits for an AI call. Returns the post-deduct balance,
 * or null if the business doesn't have enough credits. Writes the usage ledger
 * row in the same transaction so the balance and ledger never drift.
 *
 * Founder businesses (isFounderComp=true) skip the deduction but still get a
 * usage row (creditsDelta=0) so we can still see what they've used.
 */
async function reserveCredits(
  businessId: number,
  feature: string,
  credits: number,
  costCents: number,
  metadata: Record<string, unknown> = {},
): Promise<{ balance: number; deducted: number } | { error: "INSUFFICIENT" }> {
  return await pgDb.transaction(async (tx) => {
    // Lock the credit row for update
    const [row] = await tx
      .select()
      .from(aiCredits)
      .where(eq(aiCredits.businessId, businessId))
      .for("update");

    // No row yet (e.g. business never received a grant). Treat as zero
    // balance UNLESS this is a founder business (we'll backfill the row).
    if (!row) {
      const [biz] = await tx
        .select({ name: businesses.name })
        .from(businesses)
        .where(eq(businesses.id, businessId));
      // Founder eligibility uses the canonical name allowlist (mirrors the
      // monthly grant job in server/aiLab.ts which sets isFounderComp on row
      // creation). Once the row exists, only ai_credits.is_founder_comp is
      // consulted — the name check is a one-shot bootstrap.
      const founder = isFounderName(biz?.name);
      await tx
        .insert(aiCredits)
        .values({ businessId, balance: 0, isFounderComp: founder })
        .onConflictDoNothing({ target: aiCredits.businessId });
      if (!founder) {
        return { error: "INSUFFICIENT" as const };
      }
      // Founder: log usage with 0 delta and continue
      await tx.insert(aiCreditTransactions).values({
        businessId,
        type: "usage",
        feature,
        creditsDelta: 0,
        costCents,
        metadata: JSON.stringify(metadata),
      });
      return { balance: 0, deducted: 0 };
    }

    if (row.isFounderComp) {
      // Founders: log usage with 0 delta to keep audit trail
      await tx.insert(aiCreditTransactions).values({
        businessId,
        type: "usage",
        feature,
        creditsDelta: 0,
        costCents,
        metadata: JSON.stringify(metadata),
      });
      return { balance: row.balance ?? 0, deducted: 0 };
    }

    if ((row.balance ?? 0) < credits) {
      return { error: "INSUFFICIENT" as const };
    }

    const [updated] = await tx
      .update(aiCredits)
      .set({
        balance: sql`${aiCredits.balance} - ${credits}`,
        updatedAt: new Date(),
      })
      .where(eq(aiCredits.businessId, businessId))
      .returning({ balance: aiCredits.balance });

    await tx.insert(aiCreditTransactions).values({
      businessId,
      type: "usage",
      feature,
      creditsDelta: -credits,
      costCents,
      metadata: JSON.stringify(metadata),
    });

    return { balance: updated.balance ?? 0, deducted: credits };
  });
}

/* ─────────── Listing description writer ─────────── */

const LISTING_DESCRIPTION_COST_CREDITS = 5;
// Estimated OpenAI cost in cents for one gpt-4o-mini call (~700 tokens out).
// Used only for admin revenue reporting, not billing.
const LISTING_DESCRIPTION_COST_CENTS = 1;

interface ListingFacts {
  services?: string;
  yearsInBusiness?: number | string;
  uniqueValueProps?: string;
  tone?: "professional" | "friendly" | "luxury" | "casual";
}

function buildListingPrompt(
  biz: typeof businesses.$inferSelect,
  facts: ListingFacts,
): string {
  const tone = facts.tone || "friendly";
  return `You are writing a polished business listing description for a local
directory in Moyock, NC. Generate THREE distinct description variants for the
business below. Each variant must:
- Be 2-4 sentences (60-120 words)
- Open with a hook, not the business name
- Mention what they do and who they serve
- Sound human, never use "We are committed to" or AI-cliché phrases
- Not invent facts — only use what's provided
- Use "${tone}" tone

Business name: ${biz.name}
Category: ${biz.category}
City: ${biz.city ?? "Moyock"}, ${biz.state ?? "NC"}
${facts.services ? `Services: ${facts.services}` : ""}
${facts.yearsInBusiness ? `Years in business: ${facts.yearsInBusiness}` : ""}
${facts.uniqueValueProps ? `What makes them unique: ${facts.uniqueValueProps}` : ""}

Respond ONLY with this JSON shape (no prose):
{
  "variants": [
    { "label": "Concise", "text": "..." },
    { "label": "Story-driven", "text": "..." },
    { "label": "Service-focused", "text": "..." }
  ]
}`;
}

export function registerAiFeatureRoutes(app: Express) {
  /* GET balance for the dashboard widget */
  app.get(
    "/api/businesses/:id/ai-credits",
    isAuthenticated,
    async (req, res) => {
      const businessId = parseInt(req.params.id, 10);
      if (!Number.isInteger(businessId)) {
        return res.status(400).json({ message: "Invalid id" });
      }
      const auth = await authorizeOwnerOnGold(req, res, businessId);
      if (!auth) return;
      const [row] = await pgDb
        .select()
        .from(aiCredits)
        .where(eq(aiCredits.businessId, businessId));
      res.json({
        balance: row?.balance ?? 0,
        monthlyAllowance: row?.monthlyAllowance ?? 250,
        cycleResetsAt: row?.cycleResetsAt ?? null,
        isFounder: row?.isFounderComp ?? isFounderName(auth.business.name),
        eligible: true,
      });
    },
  );

  /* POST listing description writer */
  app.post(
    "/api/ai/listing-description",
    isAuthenticated,
    async (req, res) => {
      const parsedBody = ListingRequestSchema.safeParse(req.body);
      if (!parsedBody.success) {
        return res.status(400).json({
          message: "Invalid request",
          errors: parsedBody.error.flatten(),
        });
      }
      const { businessId, facts } = parsedBody.data;
      const auth = await authorizeOwnerOnGold(req, res, businessId);
      if (!auth) return;

      // Reserve credits FIRST (cheap, no external call) so we never hit
      // OpenAI for a business that can't pay.
      const reservation = await reserveCredits(
        businessId,
        "listing_description",
        LISTING_DESCRIPTION_COST_CREDITS,
        LISTING_DESCRIPTION_COST_CENTS,
        { tone: facts?.tone ?? "friendly" },
      );
      if ("error" in reservation) {
        return res.status(402).json({
          message: `Not enough credits. This feature costs ${LISTING_DESCRIPTION_COST_CREDITS} credits.`,
          code: "INSUFFICIENT_CREDITS",
          required: LISTING_DESCRIPTION_COST_CREDITS,
        });
      }

      try {
        const openai = new OpenAI({
          apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
          baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
        });
        const completion = await openai.chat.completions.create({
          model: "gpt-4o-mini",
          messages: [
            { role: "user", content: buildListingPrompt(auth.business, facts ?? {}) },
          ],
          temperature: 0.8,
          response_format: { type: "json_object" },
        });
        const raw = completion.choices[0]?.message?.content || "{}";
        let parsedJson: unknown = {};
        try {
          parsedJson = JSON.parse(raw);
        } catch {
          parsedJson = {};
        }
        const validated = AiResponseSchema.safeParse(parsedJson);
        if (!validated.success) {
          console.error(
            "[ai] listing-description bad shape:",
            validated.error.flatten(),
          );
          return res.status(502).json({
            message:
              "AI returned an unexpected response. Your credits have been used; please try again.",
            code: "AI_BAD_RESPONSE",
          });
        }
        res.json({
          variants: validated.data.variants,
          balance: reservation.balance,
          deducted: reservation.deducted,
          feature: "listing_description",
        });
      } catch (err: any) {
        console.error("[ai] listing-description failed:", err?.message ?? err);
        res.status(502).json({
          message: "AI generation failed. Please try again.",
          code: "AI_REQUEST_FAILED",
        });
      }
    },
  );

  /* ─────────── Review reply generator ─────────── */
  app.post("/api/ai/review-reply", isAuthenticated, async (req, res) => {
    const ReplyRequestSchema = z.object({
      reviewId: z.number().int().positive(),
      tone: z
        .enum(["professional", "warm", "apologetic"])
        .optional()
        .default("warm"),
    });
    const parsedBody = ReplyRequestSchema.safeParse(req.body);
    if (!parsedBody.success) {
      return res.status(400).json({
        message: "Invalid request",
        errors: parsedBody.error.flatten(),
      });
    }
    const { reviewId, tone } = parsedBody.data;

    // Initial load — used for ownership/eligibility resolution. Re-checked
    // atomically below right before we spend credits to close a TOCTOU
    // window where the owner could post a manual reply between the eligibility
    // check and the AI call.
    const [review] = await pgDb
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId));
    if (!review) {
      return res.status(404).json({ message: "Review not found" });
    }
    if (review.ownerResponse !== null) {
      return res.status(400).json({
        message: "This review already has an owner response.",
        code: "ALREADY_REPLIED",
      });
    }

    const auth = await authorizeOwnerOnGold(req, res, review.businessId);
    if (!auth) return;

    // Atomically re-verify the review is still unreplied. If something raced
    // us, return 400 ALREADY_REPLIED without spending credits.
    const [recheck] = await pgDb
      .select({ ownerResponse: reviews.ownerResponse })
      .from(reviews)
      .where(eq(reviews.id, reviewId));
    if (!recheck || recheck.ownerResponse !== null) {
      return res.status(400).json({
        message: "This review already has an owner response.",
        code: "ALREADY_REPLIED",
      });
    }

    const COST_CREDITS = 3;
    const COST_CENTS = 1;
    const reservation = await reserveCredits(
      review.businessId,
      "review_reply",
      COST_CREDITS,
      COST_CENTS,
      { reviewId, tone },
    );
    if ("error" in reservation) {
      return res.status(402).json({
        message: `Not enough credits. This feature costs ${COST_CREDITS} credits.`,
        code: "INSUFFICIENT_CREDITS",
        required: COST_CREDITS,
      });
    }

    try {
      const openai = new OpenAI({
        apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
        baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
      });

      const ratingLabel =
        review.rating >= 4
          ? "positive"
          : review.rating === 3
            ? "neutral"
            : "negative";

      const prompt = `You are helping a small-business owner reply to a customer
review on a local directory. The reply should be 1-3 sentences, sound human,
and never use AI clichés ("We are committed to...", "Thank you for your valuable
feedback"). Generate TWO distinct reply options.

Business name: ${auth.business.name}
Category: ${auth.business.category}
Review rating: ${review.rating}/5 (${ratingLabel})
Review text: "${review.comment}"
Tone: ${tone}

Rules:
- For ${ratingLabel} reviews: ${
        ratingLabel === "negative"
          ? "acknowledge the issue specifically, take ownership without making excuses, and invite the customer to follow up directly."
          : ratingLabel === "neutral"
            ? "thank them, address any specific concern they raised, and gently invite them back."
            : "thank them by referencing something specific they mentioned. Don't be generic."
      }
- Address the reviewer naturally; don't say "Dear Customer".
- Sign-offs are optional; if used, just the business name (no "Sincerely,").
- Don't promise refunds, free service, or specific compensation.
- Don't fabricate facts about the visit.

Respond ONLY with this JSON shape (no prose):
{
  "variants": [
    { "label": "Direct", "text": "..." },
    { "label": "Empathetic", "text": "..." }
  ]
}`;

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
        response_format: { type: "json_object" },
      });
      const raw = completion.choices[0]?.message?.content || "{}";
      let parsedJson: unknown = {};
      try {
        parsedJson = JSON.parse(raw);
      } catch {
        parsedJson = {};
      }
      const ReplyResponseSchema = z.object({
        variants: z
          .array(
            z.object({
              label: z.string().min(1).max(40),
              text: z.string().min(10).max(800),
            }),
          )
          .length(2),
      });
      const validated = ReplyResponseSchema.safeParse(parsedJson);
      if (!validated.success) {
        console.error(
          "[ai] review-reply bad shape:",
          validated.error.flatten(),
        );
        return res.status(502).json({
          message:
            "AI returned an unexpected response. Your credits have been used; please try again.",
          code: "AI_BAD_RESPONSE",
        });
      }
      res.json({
        variants: validated.data.variants,
        balance: reservation.balance,
        deducted: reservation.deducted,
        feature: "review_reply",
      });
    } catch (err: any) {
      console.error("[ai] review-reply failed:", err?.message ?? err);
      res.status(502).json({
        message: "AI generation failed. Please try again.",
        code: "AI_REQUEST_FAILED",
      });
    }
  });
}
