// Tests for handleMembershipSubscriptionDeleted — the path that fires from
// Stripe's `customer.subscription.deleted` webhook for a MEMBERSHIP
// subscription. Verifies the business is flipped off the paid tier, the
// stripeSubscriptionId pointer is cleared, and a `membership_downgrades`
// row is recorded for the win-back flow. Stripe is fully stubbed via a
// hand-rolled Subscription literal — no SDK calls happen here.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray, desc } from "drizzle-orm";
import type Stripe from "stripe";

import { db as pgDb } from "../db";
import { businesses, membershipDowngrades } from "@shared/schema";
import { handleMembershipSubscriptionDeleted } from "../stripe";

const TEST_TAG = "__sub_deleted_test__";

let createdBusinessIds: number[] = [];

async function seedBusiness(opts: {
  name: string;
  membershipTier?: "none" | "basic" | "standard" | "premium";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  membershipPaymentFrequency?: string | null;
}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: opts.name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `${opts.name.replace(/\s+/g, "").toLowerCase()}@example.com`,
      membershipTier: opts.membershipTier ?? "standard",
      stripeCustomerId: opts.stripeCustomerId ?? null,
      stripeSubscriptionId: opts.stripeSubscriptionId ?? null,
      membershipPaymentFrequency: opts.membershipPaymentFrequency ?? "monthly",
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function cleanup() {
  if (createdBusinessIds.length === 0) return;
  await pgDb.delete(membershipDowngrades).where(inArray(membershipDowngrades.businessId, createdBusinessIds));
  await pgDb.delete(businesses).where(inArray(businesses.id, createdBusinessIds));
  createdBusinessIds = [];
}

before(async () => {
  const stragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (stragglers.length) {
    const ids = stragglers.map((s) => s.id);
    await pgDb.delete(membershipDowngrades).where(inArray(membershipDowngrades.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
});

function makeSub(opts: {
  id: string;
  metadata?: Record<string, string>;
  customer?: string | null;
}): Stripe.Subscription {
  return {
    id: opts.id,
    metadata: opts.metadata ?? {},
    customer: opts.customer ?? null,
  } as unknown as Stripe.Subscription;
}

test("happy path: deleted membership sub flips business to 'none' AND records a downgrade row with a 2-month win-back window", async () => {
  const biz = await seedBusiness({
    name: "Cancel Happy",
    membershipTier: "premium",
    stripeCustomerId: "cus_cancel_happy",
    stripeSubscriptionId: "sub_cancel_happy",
  });

  const t0 = Date.now();
  const result = await handleMembershipSubscriptionDeleted(
    makeSub({
      id: "sub_cancel_happy",
      metadata: { businessId: String(biz.id) },
      customer: "cus_cancel_happy",
    }),
  );

  assert.equal(result.businessId, biz.id);
  assert.equal(result.previousTier, "premium");

  const [row] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(row.membershipTier, "none", "tier must drop to none");
  assert.equal(row.membershipPaymentFrequency, null, "payment frequency must be cleared");
  assert.equal(row.stripeSubscriptionId, null, "sub pointer must be cleared so re-signup re-attaches cleanly");
  assert.ok(row.membershipEndDate, "membershipEndDate must be stamped");

  const [downgrade] = await pgDb
    .select()
    .from(membershipDowngrades)
    .where(eq(membershipDowngrades.businessId, biz.id))
    .orderBy(desc(membershipDowngrades.id))
    .limit(1);
  assert.ok(downgrade, "a membership_downgrades row must be inserted");
  assert.equal(downgrade.previousTier, "premium");
  assert.equal(downgrade.newTier, "none");
  const winBackMs = downgrade.winBackEligibleAt!.getTime();
  // ~2 months out — accept anywhere between 55 and 65 days from t0.
  const minWin = t0 + 55 * 24 * 3600 * 1000;
  const maxWin = t0 + 65 * 24 * 3600 * 1000;
  assert.ok(winBackMs >= minWin && winBackMs <= maxWin, `winBackEligibleAt out of range: ${new Date(winBackMs).toISOString()}`);
});

test("falls back to stripeSubscriptionId lookup when metadata.businessId is missing", async () => {
  const biz = await seedBusiness({
    name: "Cancel By Sub",
    membershipTier: "basic",
    stripeCustomerId: "cus_by_sub",
    stripeSubscriptionId: "sub_by_sub_lookup",
  });

  const result = await handleMembershipSubscriptionDeleted(
    makeSub({ id: "sub_by_sub_lookup", customer: "cus_by_sub" }),
  );

  assert.equal(result.businessId, biz.id, "must resolve via stripeSubscriptionId column");
  const [row] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(row.membershipTier, "none");
});

test("falls back to stripeCustomerId lookup when neither metadata nor sub pointer matches (e.g. sub was already swapped)", async () => {
  const biz = await seedBusiness({
    name: "Cancel By Customer",
    membershipTier: "standard",
    stripeCustomerId: "cus_by_customer",
    // Note: stored sub is DIFFERENT from the one being deleted, so the
    // sub-pointer lookup misses and we have to fall back to the customer.
    stripeSubscriptionId: "sub_currently_attached",
  });

  const result = await handleMembershipSubscriptionDeleted(
    makeSub({ id: "sub_old_one", customer: "cus_by_customer" }),
  );

  assert.equal(result.businessId, biz.id);
  const [row] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(row.membershipTier, "none");
});

test("business already on 'none' tier: still clears sub pointer but does NOT insert a redundant downgrade row", async () => {
  const biz = await seedBusiness({
    name: "Already None",
    membershipTier: "none",
    stripeCustomerId: "cus_already_none",
    stripeSubscriptionId: "sub_already_none",
  });

  const result = await handleMembershipSubscriptionDeleted(
    makeSub({ id: "sub_already_none", metadata: { businessId: String(biz.id) } }),
  );

  assert.equal(result.previousTier, "none");
  const downgrades = await pgDb
    .select()
    .from(membershipDowngrades)
    .where(eq(membershipDowngrades.businessId, biz.id));
  assert.equal(downgrades.length, 0, "must NOT log a downgrade when there was nothing to lose");

  const [row] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(row.stripeSubscriptionId, null, "sub pointer is still cleared so the row stays clean");
});

test("unknown subscription (no business resolves) is a safe no-op", async () => {
  const result = await handleMembershipSubscriptionDeleted(
    makeSub({ id: "sub_orphan_xxx", customer: "cus_orphan_xxx" }),
  );
  assert.equal(result.businessId, null);
  assert.equal(result.previousTier, null);
});
