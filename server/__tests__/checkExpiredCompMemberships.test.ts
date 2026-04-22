// Disable real email sending before any module loads. notifyOwnerCompExpired
// is called fire-and-forget by the job; clearing the API key short-circuits
// it inside getResend() with just a console.warn.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { and, eq, inArray } from "drizzle-orm";

import { db as pgDb } from "../db";
import { businesses, compMembershipAudit } from "@shared/schema";
import { isCompActive } from "@shared/config/membership";
import { checkExpiredCompMemberships } from "../routes";

const TEST_TAG = "__compexpiry_test__";

async function seedBusiness(overrides: {
  name: string;
  isCompedMembership: boolean;
  compedMembershipExpiresAt: Date | null;
  membershipTier?: string | null;
}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: overrides.name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: "owner@example.com",
      membershipTier: overrides.membershipTier ?? "basic",
      isCompedMembership: overrides.isCompedMembership,
      compedMembershipNote: "test grant",
      compedMembershipGrantedAt: new Date(Date.now() - 30 * 24 * 3600_000),
      compedMembershipGrantedBy: "test-admin",
      compedMembershipExpiresAt: overrides.compedMembershipExpiresAt,
    })
    .returning();
  return row;
}

let createdBusinessIds: number[] = [];

async function cleanup() {
  if (createdBusinessIds.length === 0) return;
  await pgDb
    .delete(compMembershipAudit)
    .where(inArray(compMembershipAudit.businessId, createdBusinessIds));
  await pgDb.delete(businesses).where(inArray(businesses.id, createdBusinessIds));
  createdBusinessIds = [];
}

before(async () => {
  // Pre-clean any stragglers from previous runs.
  const stragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (stragglers.length) {
    const ids = stragglers.map((s) => s.id);
    await pgDb
      .delete(compMembershipAudit)
      .where(inArray(compMembershipAudit.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
});

test("clears comp flag, writes 'expire' audit row, and isCompActive becomes false for past-dated comps", async () => {
  const past = new Date(Date.now() - 24 * 3600_000);
  const seeded = await seedBusiness({
    name: "Expired Comp Co",
    isCompedMembership: true,
    compedMembershipExpiresAt: past,
  });
  createdBusinessIds.push(seeded.id);

  // Sanity: while seeded but before the job runs, the helper still sees
  // it as inactive (because expiry already passed). The job should bring
  // the DB row into agreement with that.
  assert.equal(isCompActive(seeded), false);

  await checkExpiredCompMemberships();

  const [after] = await pgDb
    .select()
    .from(businesses)
    .where(eq(businesses.id, seeded.id));

  assert.equal(after.isCompedMembership, false, "comp flag should be cleared");
  assert.equal(after.compedMembershipExpiresAt, null, "expiry should be cleared");
  assert.equal(after.compedMembershipNote, null, "note should be cleared");
  assert.equal(after.compedMembershipGrantedAt, null, "grantedAt should be cleared");
  assert.equal(after.compedMembershipGrantedBy, null, "grantedBy should be cleared");
  assert.equal(isCompActive(after), false, "isCompActive must be false after job");

  const audits = await pgDb
    .select()
    .from(compMembershipAudit)
    .where(
      and(
        eq(compMembershipAudit.businessId, seeded.id),
        eq(compMembershipAudit.action, "expire"),
      ),
    );
  assert.equal(audits.length, 1, "exactly one 'expire' audit row should exist");
  assert.equal(audits[0].actorUserId, null, "expire audit has no human actor");
});

test("does NOT touch businesses whose comp expiry is still in the future", async () => {
  const future = new Date(Date.now() + 7 * 24 * 3600_000);
  const seeded = await seedBusiness({
    name: "Active Comp Co",
    isCompedMembership: true,
    compedMembershipExpiresAt: future,
  });
  createdBusinessIds.push(seeded.id);

  await checkExpiredCompMemberships();

  const [after] = await pgDb
    .select()
    .from(businesses)
    .where(eq(businesses.id, seeded.id));

  assert.equal(after.isCompedMembership, true, "future-expiry comp must remain active");
  assert.ok(after.compedMembershipExpiresAt, "expiry timestamp must be preserved");
  assert.equal(
    new Date(after.compedMembershipExpiresAt!).getTime(),
    future.getTime(),
    "expiry timestamp value must be unchanged",
  );
  assert.equal(isCompActive(after), true, "isCompActive must still be true");

  const audits = await pgDb
    .select()
    .from(compMembershipAudit)
    .where(eq(compMembershipAudit.businessId, seeded.id));
  assert.equal(audits.length, 0, "no audit rows should be written for non-expired comps");
});

test("is idempotent: running twice produces only one 'expire' audit row per expired business", async () => {
  const past = new Date(Date.now() - 60 * 60_000);
  const seeded = await seedBusiness({
    name: "Idempotent Co",
    isCompedMembership: true,
    compedMembershipExpiresAt: past,
  });
  createdBusinessIds.push(seeded.id);

  await checkExpiredCompMemberships();
  await checkExpiredCompMemberships();

  const audits = await pgDb
    .select()
    .from(compMembershipAudit)
    .where(
      and(
        eq(compMembershipAudit.businessId, seeded.id),
        eq(compMembershipAudit.action, "expire"),
      ),
    );
  assert.equal(audits.length, 1, "second run must be a no-op for the same business");
});
