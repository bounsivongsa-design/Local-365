// Tests for requeueStuckProcessingReferrals — the boot-time safety net
// that flips orphaned 'processing' referrals back to 'pending' so the
// next webhook delivery can complete them.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";

import { db as pgDb } from "../db";
import { businesses, referrals } from "@shared/schema";
import { requeueStuckProcessingReferrals } from "../referrals";

const TEST_TAG = "__requeue_referral_test__";

let createdBusinessIds: number[] = [];
let createdReferralIds: number[] = [];

async function seedBusiness(name: string) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `${name.replace(/\s+/g, "").toLowerCase()}@example.com`,
      membershipTier: "basic",
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function seedReferral(opts: {
  referrerBusinessId: number;
  referredBusinessId: number;
  status: "pending" | "processing" | "rewarded";
}) {
  const [row] = await pgDb
    .insert(referrals)
    .values({
      referrerBusinessId: opts.referrerBusinessId,
      referredBusinessId: opts.referredBusinessId,
      code: "REF-TEST00",
      status: opts.status,
    })
    .returning();
  createdReferralIds.push(row.id);
  return row;
}

async function cleanup() {
  if (createdReferralIds.length) {
    await pgDb.delete(referrals).where(inArray(referrals.id, createdReferralIds));
    createdReferralIds = [];
  }
  if (createdBusinessIds.length) {
    await pgDb.delete(referrals).where(inArray(referrals.referredBusinessId, createdBusinessIds));
    await pgDb.delete(referrals).where(inArray(referrals.referrerBusinessId, createdBusinessIds));
    await pgDb.delete(businesses).where(inArray(businesses.id, createdBusinessIds));
    createdBusinessIds = [];
  }
}

before(async () => {
  const stragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (stragglers.length) {
    const ids = stragglers.map((s) => s.id);
    await pgDb.delete(referrals).where(inArray(referrals.referredBusinessId, ids));
    await pgDb.delete(referrals).where(inArray(referrals.referrerBusinessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
});

test("a referral row stuck in 'processing' is flipped back to 'pending' so the next webhook can retry", async () => {
  const referrer = await seedBusiness("Stuck Referrer");
  const referred = await seedBusiness("Stuck Referred");
  const stuck = await seedReferral({
    referrerBusinessId: referrer.id,
    referredBusinessId: referred.id,
    status: "processing",
  });

  const count = await requeueStuckProcessingReferrals();
  assert.ok(count >= 1, "should report at least the row we just seeded");

  const [after] = await pgDb.select().from(referrals).where(eq(referrals.id, stuck.id));
  assert.equal(after.status, "pending", "stuck row must be requeued");
});

test("'pending' and 'rewarded' rows are left alone — only 'processing' is touched", async () => {
  const referrerA = await seedBusiness("A Referrer");
  const referredA = await seedBusiness("A Referred");
  const referrerB = await seedBusiness("B Referrer");
  const referredB = await seedBusiness("B Referred");

  const pending = await seedReferral({
    referrerBusinessId: referrerA.id,
    referredBusinessId: referredA.id,
    status: "pending",
  });
  const rewarded = await seedReferral({
    referrerBusinessId: referrerB.id,
    referredBusinessId: referredB.id,
    status: "rewarded",
  });

  await requeueStuckProcessingReferrals();

  const [p] = await pgDb.select().from(referrals).where(eq(referrals.id, pending.id));
  const [r] = await pgDb.select().from(referrals).where(eq(referrals.id, rewarded.id));
  assert.equal(p.status, "pending", "pending row must stay pending");
  assert.equal(r.status, "rewarded", "rewarded row must stay rewarded");
});

test("running twice in a row is safe: the second call leaves the (now-pending) row alone", async () => {
  const referrer = await seedBusiness("Twice Referrer");
  const referred = await seedBusiness("Twice Referred");
  const stuck = await seedReferral({
    referrerBusinessId: referrer.id,
    referredBusinessId: referred.id,
    status: "processing",
  });

  await requeueStuckProcessingReferrals();
  const [afterFirst] = await pgDb.select().from(referrals).where(eq(referrals.id, stuck.id));
  assert.equal(afterFirst.status, "pending");

  // Second call must not fail and must not flip the row back to anything weird.
  await requeueStuckProcessingReferrals();
  const [afterSecond] = await pgDb.select().from(referrals).where(eq(referrals.id, stuck.id));
  assert.equal(afterSecond.status, "pending");
});
