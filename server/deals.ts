/**
 * Marketing Suite #4 — Daily Deals / Limited-Time Offers
 *
 * - Public read endpoint returns only currently-active deals
 *   (status='active' AND startsAt <= now AND endsAt > now). No cron.
 * - Owner CRUD gated to the linked business owner; create/update gated
 *   to Gold. Read of own deals is allowed for any tier so a Bronze owner
 *   can still see the upgrade prompt with their archived state intact.
 * - Click tracking is fire-and-forget (200 even if increment fails).
 */
import type { Express } from "express";
import { db as pgDb } from "./db";
import { businesses, users, deals } from "@shared/schema";
import { and, eq, sql, desc } from "drizzle-orm";
import { z } from "zod";
import { isAuthenticated } from "./replit_integrations/auth";

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

async function authorizeOwner(
  req: any,
  res: any,
  businessId: number,
  requireGold = false,
) {
  const userId = req.user?.id;
  if (!userId) { res.status(401).json({ message: "Unauthorized" }); return null; }
  const [u] = await pgDb.select({ id: users.id, linkedBusinessId: users.linkedBusinessId }).from(users).where(eq(users.id, userId));
  if (!u) { res.status(401).json({ message: "Unauthorized" }); return null; }
  const [b] = await pgDb.select().from(businesses).where(eq(businesses.id, businessId));
  if (!b) { res.status(404).json({ message: "Business not found" }); return null; }
  if (u.linkedBusinessId !== b.id) { res.status(403).json({ message: "You don't own this business" }); return null; }
  if (requireGold && effectiveTier(b) !== "premium") {
    res.status(403).json({ message: "Daily Deals require Gold membership.", code: "GOLD_REQUIRED" });
    return null;
  }
  return { business: b };
}

const DealInputSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(800),
  discountText: z.string().trim().min(2).max(60),
  redemptionInstructions: z.string().trim().min(5).max(400),
  startsAt: z.coerce.date(),
  endsAt: z.coerce.date(),
}).refine((d) => d.endsAt > d.startsAt, { message: "End must be after start", path: ["endsAt"] })
  .refine((d) => d.endsAt > new Date(), { message: "End must be in the future", path: ["endsAt"] });

export function registerDealRoutes(app: Express) {
  // PUBLIC: list active deals (with business name + slug for linking)
  app.get("/api/deals", async (_req, res) => {
    const rows = await pgDb
      .select({
        id: deals.id,
        businessId: deals.businessId,
        title: deals.title,
        description: deals.description,
        discountText: deals.discountText,
        redemptionInstructions: deals.redemptionInstructions,
        startsAt: deals.startsAt,
        endsAt: deals.endsAt,
        clickCount: deals.clickCount,
        businessName: businesses.name,
        businessLogoUrl: businesses.logoUrl,
        businessCategory: businesses.category,
      })
      .from(deals)
      .innerJoin(businesses, eq(deals.businessId, businesses.id))
      .where(and(
        eq(deals.status, "active"),
        sql`${deals.startsAt} <= NOW()`,
        sql`${deals.endsAt} > NOW()`,
      ))
      .orderBy(desc(deals.createdAt));
    res.json({ deals: rows, total: rows.length });
  });

  // PUBLIC: track a click (fire-and-forget)
  app.post("/api/deals/:id/click", async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) return res.status(400).json({ message: "Invalid id" });
    try {
      await pgDb.update(deals).set({ clickCount: sql`${deals.clickCount} + 1` }).where(eq(deals.id, id));
    } catch {}
    res.json({ ok: true });
  });

  // OWNER: list this business's deals (any status)
  app.get("/api/businesses/:id/deals", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    const auth = await authorizeOwner(req, res, businessId);
    if (!auth) return;
    const rows = await pgDb
      .select()
      .from(deals)
      .where(eq(deals.businessId, businessId))
      .orderBy(desc(deals.createdAt));
    res.json({ deals: rows, eligible: effectiveTier(auth.business) === "premium" });
  });

  // OWNER: create (Gold required)
  app.post("/api/businesses/:id/deals", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    const auth = await authorizeOwner(req, res, businessId, true);
    if (!auth) return;
    const parsed = DealInputSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    }
    const [row] = await pgDb.insert(deals).values({
      businessId,
      ...parsed.data,
      status: "active",
    }).returning();
    res.json({ deal: row });
  });

  // OWNER: update
  app.patch("/api/businesses/:id/deals/:dealId", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    const dealId = Number(req.params.dealId);
    const auth = await authorizeOwner(req, res, businessId, true);
    if (!auth) return;
    const PartialSchema = DealInputSchema.partial().extend({
      status: z.enum(["active", "paused", "archived"]).optional(),
    });
    const parsed = PartialSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
    const [row] = await pgDb
      .update(deals)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(and(eq(deals.id, dealId), eq(deals.businessId, businessId)))
      .returning();
    if (!row) return res.status(404).json({ message: "Not found" });
    res.json({ deal: row });
  });

  // OWNER: delete (hard delete — owner can also just archive via PATCH)
  app.delete("/api/businesses/:id/deals/:dealId", isAuthenticated, async (req, res) => {
    const businessId = Number(req.params.id);
    const dealId = Number(req.params.dealId);
    const auth = await authorizeOwner(req, res, businessId);
    if (!auth) return;
    const result = await pgDb
      .delete(deals)
      .where(and(eq(deals.id, dealId), eq(deals.businessId, businessId)))
      .returning({ id: deals.id });
    if (!result[0]) return res.status(404).json({ message: "Not found" });
    res.json({ ok: true });
  });
}
