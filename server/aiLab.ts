/**
 * AI Lab — Phase 1A backend
 *
 * Admin-only endpoints under /api/admin/ai-lab/*. Everything here is sandboxed:
 * no customer-facing flow reads from these endpoints. Promote to production
 * routes once each phase is approved.
 */
import type { Express, Request, Response, NextFunction } from "express";
import { db as pgDb } from "./db";
import {
  aiCredits,
  aiCreditPacks,
  aiCreditTransactions,
  businesses,
  users,
} from "@shared/schema";
import { and, desc, eq, sql } from "drizzle-orm";

// Founder businesses get unlimited AI usage; their cost is still tracked.
const FOUNDER_NAMES = new Set([
  "goat locker printing",
  "blackwater technology solutions",
]);
function isFounderBusiness(name: string | null | undefined): boolean {
  return !!name && FOUNDER_NAMES.has(name.trim().toLowerCase());
}

async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = (req as any).user?.id;
  if (!userId) return res.status(401).json({ message: "Unauthorized" });
  const [u] = await pgDb
    .select({ id: users.id, accountType: users.accountType, isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId));
  if (!u || (u.accountType !== "admin" && !u.isAdmin)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  next();
}

/**
 * Ensure a credit row exists for a business; race-safe via INSERT ON CONFLICT
 * DO NOTHING. Founder businesses get isFounderComp = true on first creation.
 * Accepts an optional `tx` for use inside a DB transaction.
 */
async function ensureCreditRow(
  businessId: number,
  businessName?: string | null,
  tx: typeof pgDb = pgDb,
) {
  const founder = isFounderBusiness(businessName);
  await tx
    .insert(aiCredits)
    .values({ businessId, balance: 0, isFounderComp: founder })
    .onConflictDoNothing({ target: aiCredits.businessId });
  const [row] = await tx
    .select()
    .from(aiCredits)
    .where(eq(aiCredits.businessId, businessId));
  return row;
}

function currentGrantPeriod(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}`;
}

export function registerAiLabRoutes(app: Express) {
  /* ─────────── Credit packs (catalog) ─────────── */
  app.get("/api/admin/ai-lab/packs", requireAdmin, async (_req, res) => {
    const packs = await pgDb
      .select()
      .from(aiCreditPacks)
      .orderBy(aiCreditPacks.sortOrder);
    res.json({ packs });
  });

  /* ─────────── Per-business credit balances ─────────── */
  app.get("/api/admin/ai-lab/balances", requireAdmin, async (_req, res) => {
    // Left join: businesses → ai_credits, so we can show all Gold members
    // even if no credit row yet.
    const rows = await pgDb
      .select({
        businessId: businesses.id,
        businessName: businesses.name,
        membershipTier: businesses.membershipTier,
        balance: aiCredits.balance,
        monthlyAllowance: aiCredits.monthlyAllowance,
        adsUsedThisCycle: aiCredits.adsUsedThisCycle,
        reelsUsedThisCycle: aiCredits.reelsUsedThisCycle,
        enhancementsUsedThisCycle: aiCredits.enhancementsUsedThisCycle,
        cycleResetsAt: aiCredits.cycleResetsAt,
        lastGrantAt: aiCredits.lastGrantAt,
        isFounderComp: aiCredits.isFounderComp,
      })
      .from(businesses)
      .leftJoin(aiCredits, eq(aiCredits.businessId, businesses.id))
      .orderBy(businesses.name);
    res.json({ balances: rows });
  });

  /* ─────────── Admin credit adjustment (sandbox tool) ─────────── */
  app.post("/api/admin/ai-lab/adjust", requireAdmin, async (req, res) => {
    const { businessId, creditsDelta, note } = req.body as {
      businessId?: number;
      creditsDelta?: number;
      note?: string;
    };
    if (!businessId || typeof creditsDelta !== "number" || !Number.isFinite(creditsDelta)) {
      return res.status(400).json({ message: "businessId and creditsDelta required" });
    }
    const [biz] = await pgDb
      .select({ id: businesses.id, name: businesses.name })
      .from(businesses)
      .where(eq(businesses.id, businessId));
    if (!biz) return res.status(404).json({ message: "Business not found" });

    // Atomic: ensure row, update balance, write ledger entry — all or nothing.
    const row = await pgDb.transaction(async (tx) => {
      await ensureCreditRow(biz.id, biz.name, tx);
      await tx
        .update(aiCredits)
        .set({
          balance: sql`${aiCredits.balance} + ${creditsDelta}`,
          updatedAt: new Date(),
        })
        .where(eq(aiCredits.businessId, businessId));
      await tx.insert(aiCreditTransactions).values({
        businessId,
        type: "admin_adjust",
        creditsDelta,
        metadata: note ? JSON.stringify({ note }) : null,
      });
      const [r] = await tx
        .select()
        .from(aiCredits)
        .where(eq(aiCredits.businessId, businessId));
      return r;
    });

    res.json({ credits: row });
  });

  /* ─────────── Manual monthly grant (cron simulator) ─────────── */
  // Grants the included monthly allowance to all active Gold members.
  // Idempotent per (businessId, type, grantPeriod) via unique index — clicking
  // twice in the same month is a safe no-op for already-granted businesses.
  // Each business is processed in its own DB transaction so a partial failure
  // never leaves balances out of sync with the ledger.
  app.post("/api/admin/ai-lab/run-monthly-grant", requireAdmin, async (req, res) => {
    const dryRun = req.body?.dryRun === true;
    const period = currentGrantPeriod();

    const goldBizzes = await pgDb
      .select({ id: businesses.id, name: businesses.name, membershipEndDate: businesses.membershipEndDate })
      .from(businesses)
      .where(eq(businesses.membershipTier, "premium"));

    const now = new Date();
    const results: Array<{ businessId: number; name: string; granted: number; skipped?: string }> = [];

    for (const biz of goldBizzes) {
      if (biz.membershipEndDate && new Date(biz.membershipEndDate) < now) {
        results.push({ businessId: biz.id, name: biz.name, granted: 0, skipped: "expired" });
        continue;
      }

      const grantType = isFounderBusiness(biz.name) ? "founder_grant" : "monthly_grant";

      if (dryRun) {
        // Fully read-only: check both whether a grant exists for this period
        // and what the business's current allowance is, without inserting rows.
        const [already] = await pgDb
          .select({ id: aiCreditTransactions.id })
          .from(aiCreditTransactions)
          .where(
            and(
              eq(aiCreditTransactions.businessId, biz.id),
              eq(aiCreditTransactions.type, grantType),
              eq(aiCreditTransactions.grantPeriod, period),
            ),
          );
        const [existingCredits] = await pgDb
          .select({ monthlyAllowance: aiCredits.monthlyAllowance })
          .from(aiCredits)
          .where(eq(aiCredits.businessId, biz.id));
        const grant = existingCredits?.monthlyAllowance ?? 250; // schema default
        results.push({
          businessId: biz.id,
          name: biz.name,
          granted: already ? 0 : grant,
          skipped: already ? `already-granted-${period}` : "dry-run",
        });
        continue;
      }

      try {
        const granted = await pgDb.transaction(async (tx) => {
          const row = await ensureCreditRow(biz.id, biz.name, tx);
          const grant = row.monthlyAllowance ?? 250;
          const nextReset = new Date(now);
          nextReset.setMonth(nextReset.getMonth() + 1);

          // Insert the ledger row FIRST. Unique index on (business_id, type,
          // grant_period) makes a duplicate click throw — we catch it below
          // and skip the balance update entirely.
          await tx.insert(aiCreditTransactions).values({
            businessId: biz.id,
            type: grantType,
            creditsDelta: grant,
            grantPeriod: period,
            metadata: JSON.stringify({ cycleResetsAt: nextReset.toISOString() }),
          });

          await tx
            .update(aiCredits)
            .set({
              balance: sql`${aiCredits.balance} + ${grant}`,
              adsUsedThisCycle: 0,
              reelsUsedThisCycle: 0,
              enhancementsUsedThisCycle: 0,
              cycleResetsAt: nextReset,
              lastGrantAt: now,
              updatedAt: now,
            })
            .where(eq(aiCredits.businessId, biz.id));

          return grant;
        });

        results.push({ businessId: biz.id, name: biz.name, granted });
      } catch (err: any) {
        // Postgres unique-violation = already granted this period. Treat as a
        // safe no-op so re-runs are idempotent. Anything else re-throws.
        if (err?.code === "23505") {
          results.push({ businessId: biz.id, name: biz.name, granted: 0, skipped: `already-granted-${period}` });
        } else {
          console.error(`[ai-lab] grant failed for ${biz.id}:`, err);
          results.push({ businessId: biz.id, name: biz.name, granted: 0, skipped: "error" });
        }
      }
    }

    res.json({
      dryRun,
      period,
      grantedCount: results.filter((r) => !r.skipped).length,
      skippedCount: results.filter((r) => !!r.skipped).length,
      totalGold: goldBizzes.length,
      results,
    });
  });

  /* ─────────── Recent transactions (audit log) ─────────── */
  app.get("/api/admin/ai-lab/transactions", requireAdmin, async (req, res) => {
    const limit = Math.min(parseInt(String(req.query.limit ?? "50"), 10) || 50, 500);
    const businessIdParam = req.query.businessId ? parseInt(String(req.query.businessId), 10) : null;

    const baseQuery = pgDb
      .select({
        id: aiCreditTransactions.id,
        businessId: aiCreditTransactions.businessId,
        businessName: businesses.name,
        type: aiCreditTransactions.type,
        feature: aiCreditTransactions.feature,
        creditsDelta: aiCreditTransactions.creditsDelta,
        costCents: aiCreditTransactions.costCents,
        revenueCents: aiCreditTransactions.revenueCents,
        metadata: aiCreditTransactions.metadata,
        createdAt: aiCreditTransactions.createdAt,
      })
      .from(aiCreditTransactions)
      .leftJoin(businesses, eq(businesses.id, aiCreditTransactions.businessId))
      .orderBy(desc(aiCreditTransactions.createdAt))
      .limit(limit);

    const txns = businessIdParam
      ? await baseQuery.where(eq(aiCreditTransactions.businessId, businessIdParam))
      : await baseQuery;

    res.json({ transactions: txns });
  });

  /* ─────────── Revenue dashboard aggregates ─────────── */
  app.get("/api/admin/ai-lab/revenue", requireAdmin, async (req, res) => {
    const months = Math.min(parseInt(String(req.query.months ?? "1"), 10) || 1, 24);
    const since = new Date();
    since.setMonth(since.getMonth() - months);
    since.setHours(0, 0, 0, 0);

    // Aggregate totals over the window
    const [totals] = await pgDb
      .select({
        revenueCents: sql<number>`COALESCE(SUM(${aiCreditTransactions.revenueCents}), 0)`,
        costCents: sql<number>`COALESCE(SUM(${aiCreditTransactions.costCents}), 0)`,
        grants: sql<number>`COALESCE(SUM(CASE WHEN ${aiCreditTransactions.type} IN ('monthly_grant','founder_grant') THEN ${aiCreditTransactions.creditsDelta} ELSE 0 END), 0)`,
        usage: sql<number>`COALESCE(SUM(CASE WHEN ${aiCreditTransactions.type} = 'usage' THEN -${aiCreditTransactions.creditsDelta} ELSE 0 END), 0)`,
        purchases: sql<number>`COALESCE(SUM(CASE WHEN ${aiCreditTransactions.type} = 'purchase' THEN ${aiCreditTransactions.creditsDelta} ELSE 0 END), 0)`,
        txnCount: sql<number>`COUNT(*)`,
      })
      .from(aiCreditTransactions)
      .where(sql`${aiCreditTransactions.createdAt} >= ${since}`);

    // Per-feature revenue/cost split (usage rows only)
    const featureBreakdown = await pgDb
      .select({
        feature: aiCreditTransactions.feature,
        costCents: sql<number>`COALESCE(SUM(${aiCreditTransactions.costCents}), 0)`,
        usageCount: sql<number>`COUNT(*)`,
      })
      .from(aiCreditTransactions)
      .where(
        and(
          eq(aiCreditTransactions.type, "usage"),
          sql`${aiCreditTransactions.createdAt} >= ${since}`,
        ),
      )
      .groupBy(aiCreditTransactions.feature);

    // Top businesses by revenue + cost
    const perBusiness = await pgDb
      .select({
        businessId: aiCreditTransactions.businessId,
        businessName: businesses.name,
        membershipTier: businesses.membershipTier,
        revenueCents: sql<number>`COALESCE(SUM(${aiCreditTransactions.revenueCents}), 0)`,
        costCents: sql<number>`COALESCE(SUM(${aiCreditTransactions.costCents}), 0)`,
        creditsUsed: sql<number>`COALESCE(SUM(CASE WHEN ${aiCreditTransactions.type} = 'usage' THEN -${aiCreditTransactions.creditsDelta} ELSE 0 END), 0)`,
      })
      .from(aiCreditTransactions)
      .leftJoin(businesses, eq(businesses.id, aiCreditTransactions.businessId))
      .where(sql`${aiCreditTransactions.createdAt} >= ${since}`)
      .groupBy(aiCreditTransactions.businessId, businesses.name, businesses.membershipTier);

    const revenueCents = Number(totals.revenueCents);
    const costCents = Number(totals.costCents);
    res.json({
      windowStart: since.toISOString(),
      months,
      totals: {
        revenueCents,
        costCents,
        netCents: revenueCents - costCents,
        marginPct: revenueCents > 0 ? Math.round(((revenueCents - costCents) / revenueCents) * 100) : 0,
        creditsGranted: Number(totals.grants),
        creditsPurchased: Number(totals.purchases),
        creditsUsed: Number(totals.usage),
        transactionCount: Number(totals.txnCount),
      },
      featureBreakdown: featureBreakdown.map((f) => ({
        feature: f.feature ?? "(none)",
        costCents: Number(f.costCents),
        usageCount: Number(f.usageCount),
      })),
      perBusiness: perBusiness
        .map((b) => ({
          businessId: b.businessId,
          businessName: b.businessName ?? "(deleted)",
          membershipTier: b.membershipTier ?? "none",
          revenueCents: Number(b.revenueCents),
          costCents: Number(b.costCents),
          netCents: Number(b.revenueCents) - Number(b.costCents),
          creditsUsed: Number(b.creditsUsed),
        }))
        .sort((a, b) => b.netCents - a.netCents),
    });
  });
}
