// Disable real email sending before any module loads — see sibling
// checkExpiredCompMemberships.test.ts for the same pattern. The reminder job
// uses an injected notifier in this test, but other code paths pulled in via
// `import "../routes"` may still touch Resend during module init.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";

import { db as pgDb } from "../db";
import { businesses } from "@shared/schema";
import {
  sendCompExpiryReminders,
  type CompExpiringNotifier,
} from "../routes";

const TEST_TAG = "__compexpiry_reminder_test__";

type ReminderCall = {
  recipientEmail: string | null | undefined;
  businessName: string;
  daysRemaining: 7 | 1;
  expiresAt: Date | string;
};

function makeNotifier(opts: { succeed?: boolean } = {}) {
  const succeed = opts.succeed ?? true;
  const calls: ReminderCall[] = [];
  const notifier: CompExpiringNotifier = async (args) => {
    calls.push({
      recipientEmail: args.recipientEmail,
      businessName: args.businessName,
      daysRemaining: args.daysRemaining,
      expiresAt: args.expiresAt,
    });
    return succeed;
  };
  return { notifier, calls };
}

async function seedBusiness(overrides: {
  name: string;
  compedMembershipExpiresAt: Date;
  reminder7Sent?: boolean;
  reminder1Sent?: boolean;
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
      membershipTier: "basic",
      isCompedMembership: true,
      compedMembershipNote: "test grant",
      compedMembershipGrantedAt: new Date(Date.now() - 30 * 24 * 3600_000),
      compedMembershipGrantedBy: "test-admin",
      compedMembershipExpiresAt: overrides.compedMembershipExpiresAt,
      compedMembershipReminder7Sent: overrides.reminder7Sent ?? false,
      compedMembershipReminder1Sent: overrides.reminder1Sent ?? false,
    })
    .returning();
  return row;
}

let createdBusinessIds: number[] = [];

async function cleanup() {
  if (createdBusinessIds.length === 0) return;
  await pgDb.delete(businesses).where(inArray(businesses.id, createdBusinessIds));
  createdBusinessIds = [];
}

before(async () => {
  const stragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (stragglers.length) {
    await pgDb
      .delete(businesses)
      .where(inArray(businesses.id, stragglers.map((s) => s.id)));
  }
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
});

async function flagsOf(id: number) {
  const [row] = await pgDb
    .select({
      r7: businesses.compedMembershipReminder7Sent,
      r1: businesses.compedMembershipReminder1Sent,
    })
    .from(businesses)
    .where(eq(businesses.id, id));
  return row;
}

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

test("T-8d comp does not trigger any reminder (still outside the 7d window)", async () => {
  const seeded = await seedBusiness({
    name: "TooEarly Co",
    compedMembershipExpiresAt: new Date(Date.now() + 8 * DAY),
  });
  createdBusinessIds.push(seeded.id);

  const { notifier, calls } = makeNotifier();
  await sendCompExpiryReminders(notifier);

  const ours = calls.filter((c) => c.businessName === "TooEarly Co");
  assert.equal(ours.length, 0, "no reminder should fire for T-8d expiry");

  const flags = await flagsOf(seeded.id);
  assert.equal(flags.r7, false, "7d flag must remain unset");
  assert.equal(flags.r1, false, "1d flag must remain unset");
});

test("T-6d comp triggers the 7d reminder and flips only the 7d flag", async () => {
  const seeded = await seedBusiness({
    name: "SixDay Co",
    compedMembershipExpiresAt: new Date(Date.now() + 6 * DAY),
  });
  createdBusinessIds.push(seeded.id);

  const { notifier, calls } = makeNotifier();
  await sendCompExpiryReminders(notifier);

  const ours = calls.filter((c) => c.businessName === "SixDay Co");
  assert.equal(ours.length, 1, "exactly one reminder should fire");
  assert.equal(ours[0].daysRemaining, 7, "should be the 7-day reminder");

  const flags = await flagsOf(seeded.id);
  assert.equal(flags.r7, true, "7d flag should be set");
  assert.equal(flags.r1, false, "1d flag should still be unset");
});

test("T-2d comp triggers the 7d reminder (1d window not yet reached)", async () => {
  const seeded = await seedBusiness({
    name: "TwoDay Co",
    compedMembershipExpiresAt: new Date(Date.now() + 2 * DAY),
  });
  createdBusinessIds.push(seeded.id);

  const { notifier, calls } = makeNotifier();
  await sendCompExpiryReminders(notifier);

  const ours = calls.filter((c) => c.businessName === "TwoDay Co");
  assert.equal(ours.length, 1);
  assert.equal(ours[0].daysRemaining, 7, "T-2d falls in the 7d window, not the 1d window");

  const flags = await flagsOf(seeded.id);
  assert.equal(flags.r7, true);
  assert.equal(flags.r1, false);
});

test("T-12h comp triggers the 1d reminder and flips BOTH flags (so the 7d email never sneaks out late)", async () => {
  const seeded = await seedBusiness({
    name: "HalfDay Co",
    compedMembershipExpiresAt: new Date(Date.now() + 12 * HOUR),
  });
  createdBusinessIds.push(seeded.id);

  const { notifier, calls } = makeNotifier();
  await sendCompExpiryReminders(notifier);

  const ours = calls.filter((c) => c.businessName === "HalfDay Co");
  assert.equal(ours.length, 1, "exactly one reminder should fire");
  assert.equal(ours[0].daysRemaining, 1, "should be the 1-day reminder");

  const flags = await flagsOf(seeded.id);
  assert.equal(flags.r1, true, "1d flag should be set");
  assert.equal(
    flags.r7,
    true,
    "7d flag should also be set so the 7-day email cannot fire afterwards",
  );
});

test("idempotent: running the warning job twice does not re-send or re-flip flags", async () => {
  const seeded = await seedBusiness({
    name: "Idempotent Reminder Co",
    compedMembershipExpiresAt: new Date(Date.now() + 6 * DAY),
  });
  createdBusinessIds.push(seeded.id);

  const { notifier, calls } = makeNotifier();
  await sendCompExpiryReminders(notifier);
  await sendCompExpiryReminders(notifier);

  const ours = calls.filter((c) => c.businessName === "Idempotent Reminder Co");
  assert.equal(ours.length, 1, "second run must be a no-op for the same expiry window");

  const flags = await flagsOf(seeded.id);
  assert.equal(flags.r7, true);
  assert.equal(flags.r1, false);
});

test("idempotent: a comp already at T-12h does not get the 1d email twice across runs", async () => {
  const seeded = await seedBusiness({
    name: "Idempotent 1d Co",
    compedMembershipExpiresAt: new Date(Date.now() + 12 * HOUR),
  });
  createdBusinessIds.push(seeded.id);

  const { notifier, calls } = makeNotifier();
  await sendCompExpiryReminders(notifier);
  await sendCompExpiryReminders(notifier);

  const ours = calls.filter((c) => c.businessName === "Idempotent 1d Co");
  assert.equal(ours.length, 1, "1d reminder should only fire once");
  assert.equal(ours[0].daysRemaining, 1);

  const flags = await flagsOf(seeded.id);
  assert.equal(flags.r1, true);
  assert.equal(flags.r7, true);
});

test("flags are NOT persisted when the notifier reports failure (so a transient outage doesn't permanently suppress the warning)", async () => {
  const seeded = await seedBusiness({
    name: "Failing Send Co",
    compedMembershipExpiresAt: new Date(Date.now() + 6 * DAY),
  });
  createdBusinessIds.push(seeded.id);

  const { notifier: failing, calls: firstCalls } = makeNotifier({ succeed: false });
  await sendCompExpiryReminders(failing);

  const flagsAfterFail = await flagsOf(seeded.id);
  assert.equal(flagsAfterFail.r7, false, "failed send must NOT flip the 7d flag");
  assert.equal(flagsAfterFail.r1, false);
  assert.equal(
    firstCalls.filter((c) => c.businessName === "Failing Send Co").length,
    1,
    "notifier was invoked once",
  );

  // Next sweep should retry now that "Resend is back".
  const { notifier: ok, calls: secondCalls } = makeNotifier({ succeed: true });
  await sendCompExpiryReminders(ok);

  const flagsAfterRetry = await flagsOf(seeded.id);
  assert.equal(flagsAfterRetry.r7, true, "successful retry should set the 7d flag");
  assert.equal(
    secondCalls.filter((c) => c.businessName === "Failing Send Co").length,
    1,
    "retry should re-attempt exactly once",
  );
});

test("a fresh comp grant (reminder flags reset, new future expiry) earns a fresh round of warnings", async () => {
  // Simulate the post-grant state: business already had warnings sent for a
  // previous expiry, then the admin re-granted (or extended) the comp. The
  // grant/update endpoints reset both reminder flags — this test asserts the
  // downstream effect: the next sweep actually fires a new 7d warning.
  const seeded = await seedBusiness({
    name: "ReGranted Co",
    compedMembershipExpiresAt: new Date(Date.now() + 30 * DAY),
    reminder7Sent: true,
    reminder1Sent: true,
  });
  createdBusinessIds.push(seeded.id);

  // First sweep: comp is far out AND flags are set, so nothing fires.
  const { notifier: n1, calls: c1 } = makeNotifier();
  await sendCompExpiryReminders(n1);
  assert.equal(
    c1.filter((c) => c.businessName === "ReGranted Co").length,
    0,
    "no reminder while expiry is 30d out and flags are still set",
  );

  // Admin shortens the comp to 6 days from now — the grant/update endpoints
  // reset both reminder flags, mirrored here directly:
  await pgDb
    .update(businesses)
    .set({
      compedMembershipExpiresAt: new Date(Date.now() + 6 * DAY),
      compedMembershipReminder7Sent: false,
      compedMembershipReminder1Sent: false,
    })
    .where(eq(businesses.id, seeded.id));

  const { notifier: n2, calls: c2 } = makeNotifier();
  await sendCompExpiryReminders(n2);

  const ours = c2.filter((c) => c.businessName === "ReGranted Co");
  assert.equal(ours.length, 1, "fresh round should send a new 7d warning");
  assert.equal(ours[0].daysRemaining, 7);

  const flags = await flagsOf(seeded.id);
  assert.equal(flags.r7, true);
  assert.equal(flags.r1, false);
});

test("expired comps (expiresAt in the past) are skipped by the warning job — that's the revert job's responsibility", async () => {
  const seeded = await seedBusiness({
    name: "AlreadyExpired Co",
    compedMembershipExpiresAt: new Date(Date.now() - 1 * HOUR),
  });
  createdBusinessIds.push(seeded.id);

  const { notifier, calls } = makeNotifier();
  await sendCompExpiryReminders(notifier);

  const ours = calls.filter((c) => c.businessName === "AlreadyExpired Co");
  assert.equal(ours.length, 0, "warning job must ignore already-expired comps");

  const flags = await flagsOf(seeded.id);
  assert.equal(flags.r7, false);
  assert.equal(flags.r1, false);
});
