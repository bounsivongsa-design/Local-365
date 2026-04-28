import type { Express, Request, Response } from "express";
import Stripe from "stripe";
import { db as pgDb } from "./db";
import { businesses, locations, users, type Business } from "@shared/schema";
import { eq, and, ne, isNull, or, sql, inArray } from "drizzle-orm";
import { isAuthenticated } from "./replit_integrations/auth";
import { getAdditionalZipPrice, ADDITIONAL_ZIP_BASE_PRICE, isCompActive } from "@shared/config/membership";

const STRIPE_KEY = process.env.Stripeintegration || process.env.STRIPE_SECRET_KEY;
let stripe: Stripe | null = STRIPE_KEY
  ? new Stripe(STRIPE_KEY, { apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion })
  : null;

// Test seam: tests can swap in a stub Stripe client (or null) without
// reloading the module. Production code never calls this.
export function __setStripeForTesting(client: Stripe | null) {
  stripe = client;
}

function getEffectiveTier(biz: Pick<Business, "membershipTier" | "goldTrialEndDate" | "isCompedMembership" | "compedMembershipExpiresAt">): string {
  if (isCompActive(biz)) return "premium";
  if (biz.goldTrialEndDate && new Date(biz.goldTrialEndDate) > new Date()) return "premium";
  return biz.membershipTier || "none";
}

// Founder/admin bypass — duplicated locally rather than imported so multiZip
// stays self-contained. Mirrors server/stripe.ts and server/routes.ts: any
// admin user, any business in FOUNDER_BUSINESSES, and any user with a
// founder email gets additional zips activated for free (no Stripe charge).
const FOUNDER_BUSINESSES_LOCAL = ["Goat Locker Printing", "Blackwater Technology Solutions"];
const FOUNDER_EMAILS_LOCAL = [
  "boun.sivongsa@gmail.com",
  "bsivongsa@blackwatertechnologysolutions.com",
  "boun.sivongsa@hotmail.com",
  "goatlockerprinting@gmail.com",
];
function normalizeBizName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.()]/g, ' ')
    .replace(/\b(llc|inc|corp|ltd|co)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}
function isFounderBiz(name: string | null | undefined): boolean {
  if (!name) return false;
  const n = normalizeBizName(name);
  return FOUNDER_BUSINESSES_LOCAL.some(fb => normalizeBizName(fb) === n);
}
function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FOUNDER_EMAILS_LOCAL.some(fe => fe.toLowerCase() === email.toLowerCase());
}
function shouldBypassChargesForOwner(
  user: { accountType?: string | null; email?: string | null } | null | undefined,
  biz: { name?: string | null } | null | undefined,
): boolean {
  if (user?.accountType === "admin") return true;
  if (isFounderEmail(user?.email)) return true;
  if (isFounderBiz(biz?.name)) return true;
  return false;
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

// Walk parentBusinessId chain to find the true root listing. Cap at 8 hops
// in case of corrupted data so we never spin forever.
async function resolveListingRoot(startId: number): Promise<Business | null> {
  let currentId: number | null = startId;
  let last: Business | null = null;
  for (let i = 0; i < 8 && currentId; i++) {
    const [row] = await pgDb.select().from(businesses).where(eq(businesses.id, currentId)).limit(1);
    if (!row) break;
    last = row;
    if (!row.parentBusinessId || row.parentBusinessId === row.id) break;
    currentId = row.parentBusinessId;
  }
  return last;
}

// Backfill `ownerUserId` across the user's whole listing graph (root + every
// child). Legacy listings only had `users.linkedBusinessId`; once we backfill,
// switching active listing won't hide the primary, even if the user is
// currently linked to a child rather than the primary.
async function backfillPrimaryOwner(userId: string, linkedId: number | null | undefined): Promise<number | null> {
  if (!linkedId) return null;
  const root = await resolveListingRoot(linkedId);
  if (!root) return null;
  await pgDb
    .update(businesses)
    .set({ ownerUserId: userId })
    .where(
      and(
        or(eq(businesses.id, root.id), eq(businesses.parentBusinessId, root.id)),
        isNull(businesses.ownerUserId),
      ),
    );
  return root.id;
}

async function loadOwnedBusiness(userId: string, businessId: number): Promise<Business | null> {
  const [biz] = await pgDb.select().from(businesses).where(eq(businesses.id, businessId)).limit(1);
  if (!biz) return null;
  if (biz.ownerUserId === userId) return biz;

  const [u] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!u?.linkedBusinessId) return null;

  const root = await resolveListingRoot(u.linkedBusinessId);
  if (!root) return null;

  // Caller's listing is the root or one of its children.
  const bizRoot = await resolveListingRoot(biz.id);
  if (!bizRoot || bizRoot.id !== root.id) return null;

  if (!biz.ownerUserId) {
    await pgDb.update(businesses).set({ ownerUserId: userId }).where(eq(businesses.id, biz.id));
    biz.ownerUserId = userId;
  }
  return biz;
}

export function registerMultiZipRoutes(app: Express) {
  // GET /api/my-businesses — every active listing owned by the caller.
  app.get("/api/my-businesses", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const [u] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
      if (!u) return res.status(404).json({ message: "User not found" });

      // One-shot backfill so legacy primaries always show up alongside children.
      await backfillPrimaryOwner(userId, u.linkedBusinessId);

      const ownerOr = [eq(businesses.ownerUserId, userId)];
      if (u.linkedBusinessId) {
        ownerOr.push(eq(businesses.id, u.linkedBusinessId));
        ownerOr.push(eq(businesses.parentBusinessId, u.linkedBusinessId));
      }

      const rows = await pgDb
        .select()
        .from(businesses)
        .where(and(or(...ownerOr), ne(businesses.status, "archived")));

      // Children of any listing the user owns (covers cases where the parent's
      // ownership came from ownerUserId rather than linkedBusinessId).
      const ownedIds = rows.map((r) => r.id);
      let extraChildren: Business[] = [];
      if (ownedIds.length) {
        extraChildren = await pgDb
          .select()
          .from(businesses)
          .where(
            and(
              inArray(businesses.parentBusinessId, ownedIds),
              ne(businesses.status, "archived"),
            ),
          );
      }
      const seen = new Set(rows.map((r) => r.id));
      for (const c of extraChildren) {
        if (!seen.has(c.id)) {
          rows.push(c);
          seen.add(c.id);
        }
      }

      const enriched = rows.map((b) => ({
        ...b,
        effectiveTier: getEffectiveTier(b),
        isPrimary: b.id === u.linkedBusinessId,
      }));
      res.json(enriched);
    } catch (err: unknown) {
      console.error("[multiZip] my-businesses:", err);
      res.status(500).json({ message: "Failed to load listings" });
    }
  });

  // POST /api/my-businesses/switch — swap which listing is "active" in the dashboard.
  app.post("/api/my-businesses/switch", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const businessId = Number(req.body?.businessId);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!businessId) return res.status(400).json({ message: "businessId required" });

      const biz = await loadOwnedBusiness(userId, businessId);
      if (!biz) return res.status(403).json({ message: "Not your listing" });
      if (biz.status === "archived") return res.status(400).json({ message: "Listing archived" });

      await pgDb.update(users).set({ linkedBusinessId: businessId }).where(eq(users.id, userId));
      res.json({ ok: true, activeBusinessId: businessId });
    } catch (err: unknown) {
      console.error("[multiZip] switch:", err);
      res.status(500).json({ message: "Failed to switch listing" });
    }
  });

  // GET /api/businesses/:id/available-zips — covered zips the owner doesn't already have.
  app.get("/api/businesses/:id/available-zips", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = Number(req.params.id);
      const biz = await loadOwnedBusiness(userId, id);
      if (!biz) return res.status(403).json({ message: "Not your listing" });

      const allLocs = await pgDb.select().from(locations);
      const owned = await pgDb
        .select({ zipCode: businesses.zipCode })
        .from(businesses)
        .where(
          and(
            or(eq(businesses.ownerUserId, userId), eq(businesses.id, id)),
            ne(businesses.status, "archived"),
          ),
        );
      const ownedSet = new Set(owned.map((o) => o.zipCode).filter(Boolean));
      const flat: Array<{ zipCode: string; city: string; state: string; region: string | null }> = [];
      const seen = new Set<string>();
      for (const loc of allLocs) {
        for (const zc of loc.zipCodes || []) {
          if (!zc || seen.has(zc) || ownedSet.has(zc)) continue;
          seen.add(zc);
          flat.push({ zipCode: zc, city: loc.city, state: loc.state, region: loc.region });
        }
      }
      res.json(flat);
    } catch (err: unknown) {
      console.error("[multiZip] available-zips:", err);
      res.status(500).json({ message: "Failed to load zips" });
    }
  });

  // GET /api/businesses/:id/add-zip-quote?zipCode=XXXXX — preview price + city/state
  // for an additional zip listing before sending the buyer to Stripe. Uses the
  // same root-listing tier logic as the checkout route so the displayed price is
  // guaranteed to match what we'll actually charge.
  app.get("/api/businesses/:id/add-zip-quote", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const parentId = Number(req.params.id);
      const zipCode = String(req.query.zipCode || "");
      const result = await quoteAddZipForOwner(userId, parentId, zipCode);
      res.status(result.status).json(result.body);
    } catch (err: unknown) {
      console.error("[multiZip] add-zip-quote:", err);
      res.status(500).json({ message: "Failed to load price" });
    }
  });

  // POST /api/businesses/:id/add-zip-checkout — start Stripe subscription for a new zip listing.
  app.post("/api/businesses/:id/add-zip-checkout", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const parentId = Number(req.params.id);
      const { zipCode } = req.body || {};
      const host = req.get("host") || "";
      const result = await startAddZipCheckoutForOwner(userId, parentId, zipCode, host);
      res.status(result.status).json(result.body);
    } catch (err: unknown) {
      console.error("[multiZip] add-zip-checkout:", err);
      res.status(500).json({ message: errMsg(err) || "Failed to start checkout" });
    }
  });

  // POST /api/businesses/:id/cancel-additional-zip — end subscription + archive the listing.
  app.post("/api/businesses/:id/cancel-additional-zip", isAuthenticated, async (req: any, res: Response) => {
    try {
      const userId = req.user?.id;
      const id = Number(req.params.id);
      const result = await cancelAdditionalZipForOwner(userId, id);
      res.status(result.status).json(result.body);
    } catch (err: unknown) {
      console.error("[multiZip] cancel-additional-zip:", err);
      res.status(500).json({ message: "Failed to cancel" });
    }
  });
}

/**
 * Look up the city/state for a covered zip and the monthly price the owner
 * would actually be charged if they added it as another listing. Mirrors the
 * tier-resolution + zip-validation logic in `startAddZipCheckoutForOwner` so
 * the UI's confirmation step shows the same price Stripe will charge.
 */
export async function quoteAddZipForOwner(
  userId: string,
  parentId: number,
  zipCode: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!zipCode) return { status: 400, body: { message: "zipCode required" } };

  const callerBiz = await loadOwnedBusiness(userId, parentId);
  if (!callerBiz) return { status: 403, body: { message: "Not your listing" } };

  const root = await resolveListingRoot(callerBiz.id);
  const parent = root || callerBiz;
  const rootId = parent.id;

  const [loc] = await pgDb
    .select()
    .from(locations)
    .where(sql`${zipCode} = ANY(COALESCE(${locations.zipCodes}, ARRAY[]::text[]))`)
    .limit(1);
  if (!loc) return { status: 400, body: { message: "Zip not in coverage area" } };

  const existing = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(
      and(
        or(
          eq(businesses.ownerUserId, userId),
          eq(businesses.id, rootId),
          eq(businesses.parentBusinessId, rootId),
        ),
        eq(businesses.zipCode, zipCode),
        ne(businesses.status, "archived"),
      ),
    )
    .limit(1);
  if (existing.length) {
    return { status: 409, body: { message: "You already have a listing in this zip" } };
  }

  const tier = getEffectiveTier(parent);
  let priceMonthly = getAdditionalZipPrice(tier);

  // Founder/admin bypass — show $0 in the confirmation modal so the user
  // isn't surprised when checkout activates the listing for free.
  const [user] = await pgDb
    .select({ email: users.email, accountType: users.accountType })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  const bypass = shouldBypassChargesForOwner(user, parent);
  if (bypass) priceMonthly = 0;

  return {
    status: 200,
    body: {
      zipCode,
      city: loc.city,
      state: loc.state,
      tier,
      priceMonthly,
      bypass,
    },
  };
}

/**
 * Pre-Stripe validation + Stripe Checkout session creation for a buyer who
 * wants to add another zip to their listing graph. Exported for testing —
 * the route handler delegates to this function. The body for the happy path
 * matches what the frontend already consumes: `{ url, priceMonthly }`.
 */
export async function startAddZipCheckoutForOwner(
  userId: string,
  parentId: number,
  zipCode: string,
  host: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  if (!zipCode) return { status: 400, body: { message: "zipCode required" } };

  const callerBiz = await loadOwnedBusiness(userId, parentId);
  if (!callerBiz) return { status: 403, body: { message: "Not your listing" } };

  // Always attach the new zip to the root listing so the graph stays flat
  // (root → children) regardless of which listing the user currently has
  // active in their dashboard.
  const root = await resolveListingRoot(callerBiz.id);
  const parent = root || callerBiz;
  const rootId = parent.id;

  // Validate zip is covered + not already owned
  const [loc] = await pgDb
    .select()
    .from(locations)
    .where(sql`${zipCode} = ANY(COALESCE(${locations.zipCodes}, ARRAY[]::text[]))`)
    .limit(1);
  if (!loc) return { status: 400, body: { message: "Zip not in coverage area" } };

  const existing = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(
      and(
        or(
          eq(businesses.ownerUserId, userId),
          eq(businesses.id, rootId),
          eq(businesses.parentBusinessId, rootId),
        ),
        eq(businesses.zipCode, zipCode),
        ne(businesses.status, "archived"),
      ),
    )
    .limit(1);
  if (existing.length) {
    return { status: 409, body: { message: "You already have a listing in this zip" } };
  }

  // Founder/admin bypass — skip Stripe entirely and create the additional-zip
  // listing directly. Mirrors handleAdditionalZipCheckoutCompleted but with
  // null subscription/customer (no Stripe records exist for free activations).
  const [callerUser] = await pgDb
    .select({ email: users.email, accountType: users.accountType })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (shouldBypassChargesForOwner(callerUser, parent)) {
    const { id: _pid, createdAt: _pc, referralCode: _prc, foundingMemberNumber: _pfn, ...inheritable } =
      parent as Record<string, unknown> & { id: number };
    const [inserted] = await pgDb
      .insert(businesses)
      .values({
        ...inheritable,
        city: loc.city,
        state: loc.state,
        zipCode,
        ownerUserId: userId,
        parentBusinessId: rootId,
        isAdditionalZip: true,
        status: "active",
        // No Stripe sub/customer for free activations.
        stripeSubscriptionId: null,
        goldTrialEndDate: null,
        originalMembershipTier: null,
        isFoundingMember: false,
        membershipStartDate: new Date(),
        referralCode: null,
        foundingMemberNumber: null,
      })
      .returning({ id: businesses.id });
    console.log(
      `[multiZip] founder/admin bypass — additional-zip listing ${inserted?.id} created free for owner ${userId} in ${zipCode}`,
    );
    return {
      status: 200,
      body: {
        founderBypass: true,
        message: `Added ${loc.city}, ${loc.state} ${zipCode} for free.`,
        priceMonthly: 0,
        listingId: inserted?.id,
      },
    };
  }

  if (!stripe) return { status: 503, body: { message: "Stripe not configured" } };

  const tier = getEffectiveTier(parent);
  const dollars = getAdditionalZipPrice(tier);
  const baseUrl = `https://${host}`;

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: parent.stripeCustomerId || undefined,
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: `Local List 365 — Additional Zip Listing (${loc.city}, ${loc.state} ${zipCode})`,
            description: `Adds ${parent.name} as a separate listing in zip ${zipCode}. Billed monthly. No trial.`,
          },
          unit_amount: dollars * 100,
          recurring: { interval: "month" },
        },
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/dashboard?addedZip=${zipCode}`,
    cancel_url: `${baseUrl}/dashboard?canceledZip=${zipCode}`,
    metadata: {
      type: "additional_zip",
      parentBusinessId: String(rootId),
      ownerUserId: userId,
      zipCode,
      city: loc.city,
      state: loc.state,
    },
    subscription_data: {
      metadata: {
        type: "additional_zip",
        parentBusinessId: String(rootId),
        ownerUserId: userId,
        zipCode,
      },
    },
  });

  return { status: 200, body: { url: session.url, priceMonthly: dollars } };
}

/**
 * Owner-initiated cancellation of an additional-zip listing. Verifies the
 * caller actually owns the listing, asks Stripe to cancel the subscription
 * (best-effort), archives the row, and re-points the user's active listing
 * if we just archived the one they were viewing.
 *
 * Exported for testing — the route handler delegates to this function.
 */
export async function cancelAdditionalZipForOwner(
  userId: string,
  id: number,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const biz = await loadOwnedBusiness(userId, id);
  if (!biz) return { status: 403, body: { message: "Not your listing" } };
  if (!biz.isAdditionalZip) {
    return {
      status: 400,
      body: { message: "Use the billing portal to cancel your primary listing" },
    };
  }
  if (stripe && biz.stripeSubscriptionId) {
    try {
      await stripe.subscriptions.cancel(biz.stripeSubscriptionId);
    } catch (e: unknown) {
      console.warn("[multiZip] cancel sub failed (continuing to archive):", errMsg(e));
    }
  }
  await pgDb.update(businesses).set({ status: "archived" }).where(eq(businesses.id, id));

  // If we just archived the active listing, switch user back to a remaining one.
  const [u] = await pgDb.select().from(users).where(eq(users.id, userId)).limit(1);
  if (u?.linkedBusinessId === id) {
    const [next] = await pgDb
      .select({ id: businesses.id })
      .from(businesses)
      .where(
        and(eq(businesses.ownerUserId, userId), ne(businesses.status, "archived"), ne(businesses.id, id)),
      )
      .limit(1);
    if (next) {
      await pgDb.update(users).set({ linkedBusinessId: next.id }).where(eq(users.id, userId));
    }
  }

  return { status: 200, body: { ok: true } };
}

/**
 * Called from the Stripe webhook on checkout.session.completed when
 * metadata.type === "additional_zip". Duplicates the parent listing into the
 * chosen zip with no Gold trial and inherits the parent's tier.
 */
export async function handleAdditionalZipCheckoutCompleted(session: Stripe.Checkout.Session) {
  const parentId = parseInt(session.metadata?.parentBusinessId || "0");
  const ownerUserId = session.metadata?.ownerUserId || "";
  const zipCode = session.metadata?.zipCode || "";
  const city = session.metadata?.city || "";
  const state = session.metadata?.state || "";
  if (!parentId || !ownerUserId || !zipCode) return;

  // Idempotency: if a listing for this subscription already exists, no-op.
  if (session.subscription) {
    const subId = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
    const existing = await pgDb
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.stripeSubscriptionId, subId))
      .limit(1);
    if (existing.length) {
      console.log(`[multiZip] additional-zip listing for sub ${subId} already exists (id=${existing[0].id})`);
      return;
    }
  }

  const [parent] = await pgDb.select().from(businesses).where(eq(businesses.id, parentId)).limit(1);
  if (!parent) {
    console.error(`[multiZip] parent business ${parentId} not found for additional-zip checkout`);
    return;
  }

  const subId = session.subscription
    ? typeof session.subscription === "string"
      ? session.subscription
      : session.subscription.id
    : null;
  const customerId = session.customer
    ? typeof session.customer === "string"
      ? session.customer
      : session.customer.id
    : parent.stripeCustomerId;

  const { id, createdAt, referralCode, foundingMemberNumber, ...inheritable } =
    parent as Record<string, unknown> & { id: number };
  const inserted = await pgDb
    .insert(businesses)
    .values({
      ...inheritable,
      city,
      state,
      zipCode,
      ownerUserId,
      parentBusinessId: parentId,
      isAdditionalZip: true,
      status: "active",
      stripeCustomerId: customerId,
      stripeSubscriptionId: subId,
      // Additional-zip listings never get the Gold trial — start clean.
      goldTrialEndDate: null,
      originalMembershipTier: null,
      isFoundingMember: false,
      membershipStartDate: new Date(),
      referralCode: null,
      foundingMemberNumber: null,
    })
    .returning({ id: businesses.id });

  console.log(`[multiZip] additional-zip listing ${inserted[0]?.id} created for owner ${ownerUserId} in ${zipCode}`);
}

/**
 * Called from the Stripe webhook on customer.subscription.deleted. If the
 * deleted subscription belongs to an additional-zip listing, archive it.
 */
export async function handleAdditionalZipSubscriptionDeleted(subscription: Stripe.Subscription) {
  const subId = subscription.id;
  const [biz] = await pgDb
    .select()
    .from(businesses)
    .where(and(eq(businesses.stripeSubscriptionId, subId), eq(businesses.isAdditionalZip, true)))
    .limit(1);
  if (!biz) return;
  await pgDb.update(businesses).set({ status: "archived" }).where(eq(businesses.id, biz.id));
  console.log(`[multiZip] archived additional-zip listing ${biz.id} after sub ${subId} cancellation`);

  // If owner's active listing was this one, swap them to another active listing.
  if (biz.ownerUserId) {
    const [u] = await pgDb.select().from(users).where(eq(users.id, biz.ownerUserId)).limit(1);
    if (u?.linkedBusinessId === biz.id) {
      const [next] = await pgDb
        .select({ id: businesses.id })
        .from(businesses)
        .where(
          and(
            eq(businesses.ownerUserId, biz.ownerUserId),
            ne(businesses.status, "archived"),
            ne(businesses.id, biz.id),
          ),
        )
        .limit(1);
      if (next) {
        await pgDb.update(users).set({ linkedBusinessId: next.id }).where(eq(users.id, biz.ownerUserId));
      }
    }
  }
}
