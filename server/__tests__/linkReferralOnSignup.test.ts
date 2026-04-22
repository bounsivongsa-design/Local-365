// Tests for linkReferralOnSignup — the signup-time hook that turns a
// pasted referral code into a 'pending' referrals row. Pure DB logic;
// no Stripe / email side effects.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";

import { db as pgDb } from "../db";
import { businesses, referrals } from "@shared/schema";
import { linkReferralOnSignup } from "../referrals";

const TEST_TAG = "__link_referral_test__";

let createdBusinessIds: number[] = [];

async function seedBusiness(opts: {
  name: string;
  referralCode?: string | null;
}): Promise<typeof businesses.$inferSelect> {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: opts.name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `${opts.name.replace(/\s+/g, "").toLowerCase()}@example.com`,
      membershipTier: "basic",
      referralCode: opts.referralCode ?? null,
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function cleanup() {
  if (createdBusinessIds.length === 0) return;
  await pgDb.delete(referrals).where(inArray(referrals.referredBusinessId, createdBusinessIds));
  await pgDb.delete(referrals).where(inArray(referrals.referrerBusinessId, createdBusinessIds));
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

test("a valid referral code creates a 'pending' referrals row pointing at the right pair", async () => {
  const referrer = await seedBusiness({ name: "Referrer Co", referralCode: "REF-VALID1" });
  const referred = await seedBusiness({ name: "Referred Co" });

  const result = await linkReferralOnSignup(referred.id, "ref-valid1"); // case-insensitive

  assert.equal(result.linked, true);
  assert.equal(result.referrerBusinessId, referrer.id);

  const rows = await pgDb
    .select()
    .from(referrals)
    .where(eq(referrals.referredBusinessId, referred.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].referrerBusinessId, referrer.id);
  assert.equal(rows[0].status, "pending");
  assert.equal(rows[0].code, "REF-VALID1", "code is normalized to uppercase");
});

test("self-referral is rejected and writes no row", async () => {
  const biz = await seedBusiness({ name: "Solo Co", referralCode: "REF-SOLO12" });

  const result = await linkReferralOnSignup(biz.id, "REF-SOLO12");

  assert.equal(result.linked, false);
  assert.equal(result.reason, "self referral");

  const rows = await pgDb
    .select()
    .from(referrals)
    .where(eq(referrals.referredBusinessId, biz.id));
  assert.equal(rows.length, 0);
});

test("an unknown code is rejected with 'code not found' and writes no row", async () => {
  const referred = await seedBusiness({ name: "Hopeful Co" });

  const result = await linkReferralOnSignup(referred.id, "REF-NOPE99");

  assert.equal(result.linked, false);
  assert.equal(result.reason, "code not found");

  const rows = await pgDb
    .select()
    .from(referrals)
    .where(eq(referrals.referredBusinessId, referred.id));
  assert.equal(rows.length, 0);
});

test("missing or whitespace-only codes are no-ops (no DB lookup, no row)", async () => {
  const referred = await seedBusiness({ name: "Empty Code Co" });

  for (const raw of [null, undefined, "", "   "]) {
    const result = await linkReferralOnSignup(referred.id, raw);
    assert.equal(result.linked, false, `should not link for ${JSON.stringify(raw)}`);
  }

  const rows = await pgDb
    .select()
    .from(referrals)
    .where(eq(referrals.referredBusinessId, referred.id));
  assert.equal(rows.length, 0);
});

test("a second link attempt for the same referee is rejected as 'already referred' (unique constraint)", async () => {
  const referrerA = await seedBusiness({ name: "First Referrer", referralCode: "REF-FIRST1" });
  await seedBusiness({ name: "Second Referrer", referralCode: "REF-SECND1" });
  const referred = await seedBusiness({ name: "Once Only Co" });

  const first = await linkReferralOnSignup(referred.id, "REF-FIRST1");
  assert.equal(first.linked, true);

  const second = await linkReferralOnSignup(referred.id, "REF-SECND1");
  assert.equal(second.linked, false);
  assert.equal(second.reason, "already referred");

  // Original row must be untouched.
  const rows = await pgDb
    .select()
    .from(referrals)
    .where(eq(referrals.referredBusinessId, referred.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].referrerBusinessId, referrerA.id);
});
