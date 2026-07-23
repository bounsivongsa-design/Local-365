// Tests for checkAbandonedBusinessCheckouts — the safety net for someone who
// pays for a membership tier at Stripe checkout but never finishes creating
// their actual business listing. See sibling checkExpiredCompMemberships.test.ts
// for the same Resend-disabling pattern.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";

import { db as pgDb } from "../db";
import { users } from "@shared/schema";
import {
  checkAbandonedBusinessCheckouts,
  type AbandonedCheckoutReminderNotifier,
  type AbandonedCheckoutCancelledNotifier,
} from "../routes";

const TEST_TAG = "abandoned-checkout-test";

type NotifyCall = { recipientEmail: string | null | undefined; firstName?: string | null };

function makeNotifier(opts: { succeed?: boolean } = {}) {
  const succeed = opts.succeed ?? true;
  const calls: NotifyCall[] = [];
  const notifier = async (args: NotifyCall) => {
    calls.push(args);
    return succeed;
  };
  return { notifier: notifier as AbandonedCheckoutReminderNotifier & AbandonedCheckoutCancelledNotifier, calls };
}

async function seedUser(overrides: {
  emailSuffix: string;
  pendingMembershipTier?: string | null;
  pendingStripeSubscriptionId?: string | null;
  pendingSince?: Date | null;
  pendingReminderSent?: boolean;
  linkedBusinessId?: number | null;
  updatedAt?: Date;
}) {
  const [row] = await pgDb
    .insert(users)
    .values({
      email: `${TEST_TAG}-${overrides.emailSuffix}@example.com`,
      firstName: "Test",
      accountType: "customer",
      pendingMembershipTier: overrides.pendingMembershipTier ?? null,
      pendingStripeSubscriptionId: overrides.pendingStripeSubscriptionId ?? null,
      pendingSince: overrides.pendingSince ?? null,
      pendingReminderSent: overrides.pendingReminderSent ?? false,
      linkedBusinessId: overrides.linkedBusinessId ?? null,
      updatedAt: overrides.updatedAt ?? new Date(),
    })
    .returning();
  return row;
}

let createdUserIds: string[] = [];

async function cleanup() {
  if (createdUserIds.length === 0) return;
  await pgDb.delete(users).where(inArray(users.id, createdUserIds));
  createdUserIds = [];
}

before(async () => {
  const stragglers = await pgDb
    .select({ id: users.id })
    .from(users)
    .where(eq(users.firstName, "Test"));
  const tagged = stragglers.map((s) => s.id); // narrowed further per-test via email prefix below
  if (tagged.length) {
    const rows = await pgDb.select({ id: users.id, email: users.email }).from(users).where(inArray(users.id, tagged));
    const ids = rows.filter((r) => (r.email || "").startsWith(TEST_TAG)).map((r) => r.id);
    if (ids.length) await pgDb.delete(users).where(inArray(users.id, ids));
  }
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
});

test("cancels and clears pending fields for a user stuck >7d with no linked business", async () => {
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600_000);
  const seeded = await seedUser({
    emailSuffix: "stuck-8d",
    pendingMembershipTier: "basic",
    pendingStripeSubscriptionId: "sub_fake_test_123",
    pendingSince: eightDaysAgo,
  });
  createdUserIds.push(seeded.id);

  const { notifier: reminderNotifier, calls: reminderCalls } = makeNotifier();
  const { notifier: cancelledNotifier, calls: cancelledCalls } = makeNotifier();

  await checkAbandonedBusinessCheckouts(reminderNotifier, cancelledNotifier);

  const [after1] = await pgDb.select().from(users).where(eq(users.id, seeded.id));
  assert.equal(after1.pendingMembershipTier, null, "pendingMembershipTier should be cleared");
  assert.equal(after1.pendingStripeSubscriptionId, null, "pendingStripeSubscriptionId should be cleared");
  assert.equal(after1.pendingSince, null, "pendingSince should be cleared");
  assert.equal(after1.pendingReminderSent, false, "pendingReminderSent should reset");

  assert.equal(cancelledCalls.length, 1, "cancelled notifier should fire exactly once");
  assert.equal(cancelledCalls[0].recipientEmail, seeded.email);
  assert.equal(reminderCalls.length, 0, "reminder notifier should not also fire in the same pass");
});

test("sends a one-time reminder (does not cancel) for a user stuck 3-7d, and does not resend once flagged", async () => {
  const fourDaysAgo = new Date(Date.now() - 4 * 24 * 3600_000);
  const seeded = await seedUser({
    emailSuffix: "stuck-4d",
    pendingMembershipTier: "standard",
    pendingStripeSubscriptionId: "sub_fake_test_456",
    pendingSince: fourDaysAgo,
  });
  createdUserIds.push(seeded.id);

  const { notifier: reminderNotifier, calls: reminderCalls } = makeNotifier();
  const { notifier: cancelledNotifier, calls: cancelledCalls } = makeNotifier();

  await checkAbandonedBusinessCheckouts(reminderNotifier, cancelledNotifier);

  const [after1] = await pgDb.select().from(users).where(eq(users.id, seeded.id));
  assert.equal(after1.pendingMembershipTier, "standard", "still pending — not cancelled yet");
  assert.equal(after1.pendingReminderSent, true, "reminder-sent flag should now be set");
  assert.equal(reminderCalls.length, 1);
  assert.equal(cancelledCalls.length, 0);

  // Second pass, same day — must not resend.
  const { notifier: reminderNotifier2, calls: reminderCalls2 } = makeNotifier();
  await checkAbandonedBusinessCheckouts(reminderNotifier2, cancelledNotifier);
  assert.equal(reminderCalls2.length, 0, "reminder must not fire twice for the same pending window");
});

test("does not touch a user still within the 3-day grace window", async () => {
  const oneDayAgo = new Date(Date.now() - 1 * 24 * 3600_000);
  const seeded = await seedUser({
    emailSuffix: "fresh-1d",
    pendingMembershipTier: "basic",
    pendingStripeSubscriptionId: "sub_fake_test_789",
    pendingSince: oneDayAgo,
  });
  createdUserIds.push(seeded.id);

  const { notifier: reminderNotifier, calls: reminderCalls } = makeNotifier();
  const { notifier: cancelledNotifier, calls: cancelledCalls } = makeNotifier();

  await checkAbandonedBusinessCheckouts(reminderNotifier, cancelledNotifier);

  const [after1] = await pgDb.select().from(users).where(eq(users.id, seeded.id));
  assert.equal(after1.pendingMembershipTier, "basic", "too early to touch");
  assert.equal(after1.pendingReminderSent, false);
  assert.equal(reminderCalls.length, 0);
  assert.equal(cancelledCalls.length, 0);
});

test("backfills a legacy row (pendingSince null) from updatedAt and sweeps it in the same pass", async () => {
  const tenDaysAgo = new Date(Date.now() - 10 * 24 * 3600_000);
  const seeded = await seedUser({
    emailSuffix: "legacy-null-pending-since",
    pendingMembershipTier: "basic",
    pendingStripeSubscriptionId: "sub_fake_test_legacy",
    pendingSince: null, // simulates a row from before this column existed
    updatedAt: tenDaysAgo,
  });
  createdUserIds.push(seeded.id);

  const { notifier: reminderNotifier, calls: reminderCalls } = makeNotifier();
  const { notifier: cancelledNotifier, calls: cancelledCalls } = makeNotifier();

  await checkAbandonedBusinessCheckouts(reminderNotifier, cancelledNotifier);

  const [after1] = await pgDb.select().from(users).where(eq(users.id, seeded.id));
  assert.equal(after1.pendingMembershipTier, null, "legacy stuck row should be cancelled in the same pass it's backfilled");
  assert.equal(cancelledCalls.length, 1);
  assert.equal(reminderCalls.length, 0);
});

test("never touches a user who already has a linked business", async () => {
  const eightDaysAgo = new Date(Date.now() - 8 * 24 * 3600_000);
  const seeded = await seedUser({
    emailSuffix: "already-linked",
    pendingMembershipTier: "basic",
    pendingStripeSubscriptionId: "sub_fake_test_linked",
    pendingSince: eightDaysAgo,
    linkedBusinessId: 999999, // doesn't need to exist for this assertion — the WHERE clause just excludes non-null
  });
  createdUserIds.push(seeded.id);

  const { notifier: reminderNotifier, calls: reminderCalls } = makeNotifier();
  const { notifier: cancelledNotifier, calls: cancelledCalls } = makeNotifier();

  await checkAbandonedBusinessCheckouts(reminderNotifier, cancelledNotifier);

  const [after1] = await pgDb.select().from(users).where(eq(users.id, seeded.id));
  assert.equal(after1.pendingMembershipTier, "basic", "linked-business users are out of scope for this job");
  assert.equal(reminderCalls.length, 0);
  assert.equal(cancelledCalls.length, 0);
});
