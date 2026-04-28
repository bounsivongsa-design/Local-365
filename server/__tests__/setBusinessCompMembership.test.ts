// Tests for setBusinessCompMembership — the helper that backs the admin
// quid-pro-quo "give a free Gold account" endpoint
// (POST /api/admin/businesses/:id/comp).
//
// What this protects:
//   1. After grant, isCompActive(b) returns true → every effectiveTier()
//      gate across the server treats the business as Gold.
//   2. The append-only audit row is written for both grant AND revoke.
//   3. Revoke clears every comp column on businesses (incl. reminder
//      flags) so the next grant starts from a clean slate.
//   4. The recipient email is resolved via business.email first and
//      falls back to the linked owner's user email so a missing
//      business.email still gets the welcome notice.
//   5. Indefinite grants (no expiry) are persisted as NULL and treated
//      as active forever by isCompActive.
//   6. Unknown business id returns null (the route surfaces this as a
//      404 to the admin caller).

process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";

import { db as pgDb } from "../db";
import { businesses, compMembershipAudit } from "@shared/schema";
import { users } from "@shared/models/auth";
import { isCompActive } from "@shared/config/membership";
import { setBusinessCompMembership } from "../comp";

const TEST_TAG = "__set_comp_test__";

let createdBizIds: number[] = [];
let createdUserIds: string[] = [];

async function seedAdmin() {
  const [row] = await pgDb
    .insert(users)
    .values({
      email: `comp_admin_${Date.now()}_${Math.random()}@example.com`,
      firstName: "Comp",
      lastName: "Admin",
      accountType: "admin",
    })
    .returning();
  createdUserIds.push(row.id);
  return row;
}

async function seedOwner(opts: { email?: string | null } = {}) {
  const [row] = await pgDb
    .insert(users)
    .values({
      email: opts.email ?? `comp_owner_${Date.now()}_${Math.random()}@example.com`,
      firstName: "Comp",
      lastName: "Owner",
    })
    .returning();
  createdUserIds.push(row.id);
  return row;
}

async function seedBusiness(opts: {
  email?: string | null;
  ownerUserId?: string | null;
  membershipTier?: string;
} = {}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: `Comp Test Biz ${Date.now()}_${Math.random()}`,
      description: TEST_TAG,
      address: "1 Quid Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: opts.email === undefined ? `biz_${Date.now()}@example.com` : opts.email,
      city: "Moyock",
      state: "NC",
      zipCode: "27958",
      membershipTier: opts.membershipTier ?? "none",
      ownerUserId: opts.ownerUserId ?? null,
    })
    .returning();
  createdBizIds.push(row.id);
  return row;
}

async function cleanup() {
  if (createdBizIds.length) {
    await pgDb
      .delete(compMembershipAudit)
      .where(inArray(compMembershipAudit.businessId, createdBizIds));
    await pgDb.delete(businesses).where(inArray(businesses.id, createdBizIds));
    createdBizIds = [];
  }
  if (createdUserIds.length) {
    await pgDb.delete(users).where(inArray(users.id, createdUserIds));
    createdUserIds = [];
  }
}

before(async () => {
  // Sweep any stragglers from a previous failed run so the test is
  // hermetic when the suite is re-run repeatedly.
  const stragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (stragglers.length) {
    const ids = stragglers.map((s) => s.id);
    await pgDb.delete(compMembershipAudit).where(inArray(compMembershipAudit.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(cleanup);
after(cleanup);

test("grant: flips isCompedMembership=true with note + future expiry, isCompActive becomes true, audit row written", async () => {
  const admin = await seedAdmin();
  const biz = await seedBusiness({ membershipTier: "none" });
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

  const result = await setBusinessCompMembership({
    bizId: biz.id,
    adminId: admin.id,
    active: true,
    note: "Gave free Gold for a year — they're letting us put a flyer in the shop window",
    expiresAt,
  });

  assert.ok(result, "result must not be null when business exists");
  assert.equal(result!.isCompedMembership, true);
  assert.equal(result!.compedMembershipExpiresAt?.getTime(), expiresAt.getTime());
  assert.equal(result!.recipientEmail, biz.email);
  assert.equal(result!.businessName, biz.name);

  const [after] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(after.isCompedMembership, true);
  assert.equal(after.compedMembershipNote, "Gave free Gold for a year — they're letting us put a flyer in the shop window");
  assert.equal(after.compedMembershipGrantedBy, admin.id);
  assert.ok(after.compedMembershipGrantedAt instanceof Date, "grantedAt must be set");
  assert.equal(after.compedMembershipExpiresAt?.getTime(), expiresAt.getTime());
  assert.equal(after.compedMembershipReminder7Sent, false);
  assert.equal(after.compedMembershipReminder1Sent, false);
  assert.equal(after.compedWelcomeEmailSentAt, null);

  // The whole point of comp: every Gold gate sees this business as Gold
  // even though its real membershipTier is still 'none'.
  assert.equal(isCompActive(after), true, "post-grant business must be Gold-equivalent");

  const audit = await pgDb
    .select()
    .from(compMembershipAudit)
    .where(eq(compMembershipAudit.businessId, biz.id));
  assert.equal(audit.length, 1);
  assert.equal(audit[0].action, "grant");
  assert.equal(audit[0].actorUserId, admin.id);
  assert.equal(audit[0].expiresAt?.getTime(), expiresAt.getTime());
});

test("grant indefinite: no expiry → compedMembershipExpiresAt is NULL and isCompActive stays true forever", async () => {
  const admin = await seedAdmin();
  const biz = await seedBusiness();

  const result = await setBusinessCompMembership({
    bizId: biz.id,
    adminId: admin.id,
    active: true,
  });

  assert.ok(result);
  assert.equal(result!.compedMembershipExpiresAt, null);

  const [after] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(after.isCompedMembership, true);
  assert.equal(after.compedMembershipExpiresAt, null);
  assert.equal(isCompActive(after), true);
});

test("revoke: clears every comp column AND writes a separate 'revoke' audit row (preserves grant history)", async () => {
  const admin = await seedAdmin();
  const biz = await seedBusiness();

  // Grant first so there's something to revoke.
  await setBusinessCompMembership({
    bizId: biz.id,
    adminId: admin.id,
    active: true,
    note: "initial grant",
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  });

  // Now revoke.
  const result = await setBusinessCompMembership({
    bizId: biz.id,
    adminId: admin.id,
    active: false,
  });

  assert.ok(result);
  assert.equal(result!.isCompedMembership, false);

  const [after] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(after.isCompedMembership, false);
  assert.equal(after.compedMembershipNote, null);
  assert.equal(after.compedMembershipGrantedAt, null);
  assert.equal(after.compedMembershipGrantedBy, null);
  assert.equal(after.compedMembershipExpiresAt, null);
  assert.equal(after.compedMembershipReminder7Sent, false);
  assert.equal(after.compedMembershipReminder1Sent, false);
  assert.equal(isCompActive(after), false, "revoked business must no longer be Gold-equivalent");

  // Append-only audit: BOTH the grant AND the revoke rows survive so the
  // historical "who/when/why" is recoverable even after revoke wipes the
  // live columns.
  const audit = await pgDb
    .select()
    .from(compMembershipAudit)
    .where(eq(compMembershipAudit.businessId, biz.id));
  assert.equal(audit.length, 2);
  const actions = audit.map((a) => a.action).sort();
  assert.deepEqual(actions, ["grant", "revoke"]);
});

test("recipient email fallback: when business.email is NULL, falls back to the linked owner user's email", async () => {
  const admin = await seedAdmin();
  const owner = await seedOwner({ email: "fallback_owner@example.com" });
  const biz = await seedBusiness({ email: null, ownerUserId: owner.id });

  const result = await setBusinessCompMembership({
    bizId: biz.id,
    adminId: admin.id,
    active: true,
  });

  assert.ok(result);
  assert.equal(
    result!.recipientEmail,
    "fallback_owner@example.com",
    "must resolve owner email when business.email is null",
  );
});

test("re-grant: flipping a previously-revoked comp back on resets reminder flags so the new window gets a fresh round of warnings", async () => {
  const admin = await seedAdmin();
  const biz = await seedBusiness();

  // Grant → simulate that both 7d and 1d reminders already fired in the
  // previous comp window → revoke → grant again. The new grant must
  // start with both reminder flags back at false.
  await setBusinessCompMembership({ bizId: biz.id, adminId: admin.id, active: true });
  await pgDb
    .update(businesses)
    .set({ compedMembershipReminder7Sent: true, compedMembershipReminder1Sent: true })
    .where(eq(businesses.id, biz.id));
  await setBusinessCompMembership({ bizId: biz.id, adminId: admin.id, active: false });

  await setBusinessCompMembership({
    bizId: biz.id,
    adminId: admin.id,
    active: true,
    expiresAt: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
  });

  const [after] = await pgDb.select().from(businesses).where(eq(businesses.id, biz.id));
  assert.equal(after.compedMembershipReminder7Sent, false, "7d reminder flag must reset on re-grant");
  assert.equal(after.compedMembershipReminder1Sent, false, "1d reminder flag must reset on re-grant");
  assert.equal(after.compedWelcomeEmailSentAt, null, "welcome-sent stamp must reset on re-grant");
});

test("unknown business id returns null (route surfaces as 404 — does NOT throw)", async () => {
  const admin = await seedAdmin();

  const result = await setBusinessCompMembership({
    bizId: 999_999_999,
    adminId: admin.id,
    active: true,
  });

  assert.equal(result, null);

  // No audit row should be written for a non-existent business.
  const audit = await pgDb
    .select()
    .from(compMembershipAudit)
    .where(eq(compMembershipAudit.businessId, 999_999_999));
  assert.equal(audit.length, 0);
});
