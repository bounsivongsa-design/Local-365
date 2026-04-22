/**
 * Marketing Suite Feature #2 — Social Composer
 *
 * Generates copy-paste-ready posts for Facebook / Instagram / Google
 * Business Profile / Nextdoor from a single piece of owner notes. Drafts
 * are persisted so the owner can come back later.
 *
 * We deliberately do NOT auto-post. Auto-posting requires Meta/Google
 * business app review (weeks of approval) and is a future feature. Copy-
 * paste + reminders captures 90% of the value with 0% of the friction.
 */
import type { Express, Request, Response } from "express";
import { db as pgDb } from "./db";
import { businesses, users, socialDrafts } from "@shared/schema";
import { and, eq, desc } from "drizzle-orm";
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
      message: "Social Composer requires Gold membership.",
      code: "GOLD_REQUIRED",
    });
    return null;
  }
  return { business: biz };
}

const VariantsSchema = z.object({
  facebook: z.string().max(2000).optional(),
  instagram: z.string().max(2200).optional(),
  googleBusiness: z.string().max(1500).optional(),
  nextdoor: z.string().max(2000).optional(),
});

const DraftCreateSchema = z.object({
  sourceNotes: z.string().min(3).max(2000),
  imageUrl: z.string().max(1000).optional().nullable(),
  variants: VariantsSchema.optional(),
});

const DraftUpdateSchema = z.object({
  sourceNotes: z.string().min(3).max(2000).optional(),
  imageUrl: z.string().max(1000).optional().nullable(),
  variants: VariantsSchema.optional(),
  status: z.enum(["draft", "posted"]).optional(),
});

export function registerSocialRoutes(app: Express) {
  // List drafts
  app.get(
    "/api/businesses/:id/social/drafts",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      if (!Number.isFinite(businessId)) {
        return res.status(400).json({ message: "Invalid business id" });
      }
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      const rows = await pgDb
        .select()
        .from(socialDrafts)
        .where(eq(socialDrafts.businessId, businessId))
        .orderBy(desc(socialDrafts.createdAt));
      res.json({ drafts: rows });
    },
  );

  // Create draft (Gold)
  app.post(
    "/api/businesses/:id/social/drafts",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const auth = await authorizeOwner(req, res, businessId, true);
      if (!auth) return;
      const parsed = DraftCreateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input", errors: parsed.error.flatten() });
      }
      const [row] = await pgDb
        .insert(socialDrafts)
        .values({
          businessId,
          sourceNotes: parsed.data.sourceNotes,
          imageUrl: parsed.data.imageUrl ?? null,
          variants: parsed.data.variants ?? {},
        })
        .returning();
      res.json({ draft: row });
    },
  );

  // Update draft
  app.patch(
    "/api/businesses/:id/social/drafts/:did",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const did = Number(req.params.did);
      const auth = await authorizeOwner(req, res, businessId, true);
      if (!auth) return;
      const parsed = DraftUpdateSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid input" });
      }
      const [existing] = await pgDb
        .select()
        .from(socialDrafts)
        .where(and(eq(socialDrafts.id, did), eq(socialDrafts.businessId, businessId)));
      if (!existing) return res.status(404).json({ message: "Draft not found" });
      const [updated] = await pgDb
        .update(socialDrafts)
        .set({
          ...(parsed.data.sourceNotes !== undefined ? { sourceNotes: parsed.data.sourceNotes } : {}),
          ...(parsed.data.imageUrl !== undefined ? { imageUrl: parsed.data.imageUrl } : {}),
          ...(parsed.data.variants !== undefined ? { variants: parsed.data.variants } : {}),
          ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
          updatedAt: new Date(),
        })
        .where(eq(socialDrafts.id, did))
        .returning();
      res.json({ draft: updated });
    },
  );

  // Delete draft
  app.delete(
    "/api/businesses/:id/social/drafts/:did",
    isAuthenticated,
    async (req, res) => {
      const businessId = Number(req.params.id);
      const did = Number(req.params.did);
      const auth = await authorizeOwner(req, res, businessId);
      if (!auth) return;
      const result = await pgDb
        .delete(socialDrafts)
        .where(and(eq(socialDrafts.id, did), eq(socialDrafts.businessId, businessId)))
        .returning({ id: socialDrafts.id });
      if (!result[0]) return res.status(404).json({ message: "Draft not found" });
      res.json({ ok: true });
    },
  );
}
