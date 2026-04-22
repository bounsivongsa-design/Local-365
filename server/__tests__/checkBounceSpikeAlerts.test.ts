// Disable real email sending before any module loads — same pattern as the
// sibling bounce-rate / comp-expiry suites. The spike job uses an injected
// notifier in this test, but other code paths pulled in via `import "../routes"`
// may still touch Resend during module init.
process.env.RESEND_API_KEY = "";
// Keep the threshold small so seeded fixtures stay readable. Production
// default (5) is asserted indirectly by the "below threshold" test where we
// override it back.
process.env.BOUNCE_SPIKE_THRESHOLD = "3";
process.env.BOUNCE_SPIKE_LOOKBACK_HOURS = "24";
process.env.BOUNCE_SPIKE_COOLDOWN_HOURS = "24";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import crypto from "crypto";

import { db as pgDb } from "../db";
import {
  businesses,
  recipientSuppressions,
  bounceSpikeAlerts,
} from "@shared/schema";
import {
  checkBounceSpikeAlerts,
  type BounceSpikeOwnerNotifier,
} from "../routes";

const TEST_TAG = "__bouncespike_owner_alert_test__";

type AlertCall = {
  recipientEmail: string | null | undefined;
  businessName: string;
  bounceCount: number;
  windowHours: number;
};

function makeNotifier(opts: { succeed?: boolean } = {}) {
  const succeed = opts.succeed ?? true;
  const calls: AlertCall[] = [];
  const notifier: BounceSpikeOwnerNotifier = async (args) => {
    calls.push({
      recipientEmail: args.recipientEmail,
      businessName: args.businessName,
      bounceCount: args.bounceCount,
      windowHours: args.windowHours,
    });
    return succeed;
  };
  return { notifier, calls };
}

async function seedBusiness(name: string, email: string | null = "owner@example.com") {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email,
      membershipTier: "premium",
    })
    .returning();
  return row;
}

async function seedSuppression(opts: {
  businessId: number;
  reason: string;
  ageMinutes?: number;
  contact?: string;
}) {
  const ageMs = (opts.ageMinutes ?? 60) * 60 * 1000;
  const ts = new Date(Date.now() - ageMs);
  await pgDb.insert(recipientSuppressions).values({
    businessId: opts.businessId,
    contactType: "email",
    contact: opts.contact ?? `r-${crypto.randomBytes(4).toString("hex")}@example.com`,
    reason: opts.reason,
    createdAt: ts,
  });
}

let createdBusinessIds: number[] = [];

async function cleanup() {
  if (createdBusinessIds.length === 0) return;
  await pgDb
    .delete(bounceSpikeAlerts)
    .where(inArray(bounceSpikeAlerts.businessId, createdBusinessIds));
  await pgDb
    .delete(recipientSuppressions)
    .where(inArray(recipientSuppressions.businessId, createdBusinessIds));
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
    await pgDb.delete(bounceSpikeAlerts).where(inArray(bounceSpikeAlerts.businessId, ids));
    await pgDb.delete(recipientSuppressions).where(inArray(recipientSuppressions.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
  delete process.env.BOUNCE_SPIKE_THRESHOLD;
  delete process.env.BOUNCE_SPIKE_LOOKBACK_HOURS;
  delete process.env.BOUNCE_SPIKE_COOLDOWN_HOURS;
});

test("emits a heads-up to the owner once webhook bounces in 24h cross the threshold and persists the cooldown row", async () => {
  const biz = await seedBusiness("HighSpike Co");
  createdBusinessIds.push(biz.id);

  for (let i = 0; i < 4; i++)
    await seedSuppression({ businessId: biz.id, reason: "webhook: bounced[hard]: x" });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);

  const ours = calls.filter((c) => c.businessName === "HighSpike Co");
  assert.equal(ours.length, 1, "exactly one heads-up should fire");
  assert.equal(ours[0].recipientEmail, "owner@example.com");
  assert.equal(ours[0].bounceCount, 4);
  assert.equal(ours[0].windowHours, 24);

  const cooldownRows = await pgDb
    .select()
    .from(bounceSpikeAlerts)
    .where(eq(bounceSpikeAlerts.businessId, biz.id));
  assert.equal(cooldownRows.length, 1, "cooldown row should be persisted on success");
  assert.equal(cooldownRows[0].bounceCount, 4);
});

test("does NOT alert when bounce count is strictly below the threshold", async () => {
  // Override threshold back to production default for this test
  process.env.BOUNCE_SPIKE_THRESHOLD = "5";
  const biz = await seedBusiness("BelowThreshold Co");
  createdBusinessIds.push(biz.id);

  for (let i = 0; i < 4; i++)
    await seedSuppression({ businessId: biz.id, reason: "webhook: bounced[hard]: x" });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);
  process.env.BOUNCE_SPIKE_THRESHOLD = "3"; // restore for sibling tests

  assert.equal(calls.filter((c) => c.businessName === "BelowThreshold Co").length, 0);

  const cooldownRows = await pgDb
    .select()
    .from(bounceSpikeAlerts)
    .where(eq(bounceSpikeAlerts.businessId, biz.id));
  assert.equal(cooldownRows.length, 0, "no cooldown row when no alert fires");
});

test("ignores non-webhook suppressions (e.g. owner manual blocks, admin sweeps)", async () => {
  const biz = await seedBusiness("ManualOnly Co");
  createdBusinessIds.push(biz.id);

  // 5 manual suppressions — must NOT count as a webhook spike
  for (let i = 0; i < 5; i++)
    await seedSuppression({ businessId: biz.id, reason: "manual: owner removed bad address" });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);

  assert.equal(
    calls.filter((c) => c.businessName === "ManualOnly Co").length,
    0,
    "manual suppressions must not trip the spike alert",
  );
});

test("ignores rows older than the lookback window", async () => {
  const biz = await seedBusiness("StaleSpike Co");
  createdBusinessIds.push(biz.id);

  // All bounces are 3 days old — outside the 24h lookback
  for (let i = 0; i < 10; i++)
    await seedSuppression({
      businessId: biz.id,
      reason: "webhook: bounced[hard]: x",
      ageMinutes: 3 * 24 * 60,
    });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);

  assert.equal(calls.filter((c) => c.businessName === "StaleSpike Co").length, 0);
});

test("idempotent within the cooldown window — running twice does not double-alert the owner", async () => {
  const biz = await seedBusiness("Cooldown Spike Co");
  createdBusinessIds.push(biz.id);

  for (let i = 0; i < 6; i++)
    await seedSuppression({ businessId: biz.id, reason: "webhook: bounced[hard]: x" });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);
  await checkBounceSpikeAlerts(notifier);

  assert.equal(
    calls.filter((c) => c.businessName === "Cooldown Spike Co").length,
    1,
    "second run within cooldown must be a no-op",
  );

  const cooldownRows = await pgDb
    .select()
    .from(bounceSpikeAlerts)
    .where(eq(bounceSpikeAlerts.businessId, biz.id));
  assert.equal(cooldownRows.length, 1, "still only one cooldown row");
});

test("when the notifier reports failure the cooldown row is NOT persisted, so the next run retries", async () => {
  const biz = await seedBusiness("RetryAfterFail Co");
  createdBusinessIds.push(biz.id);

  for (let i = 0; i < 5; i++)
    await seedSuppression({ businessId: biz.id, reason: "webhook: bounced[hard]: x" });

  const { notifier: failing, calls: c1 } = makeNotifier({ succeed: false });
  await checkBounceSpikeAlerts(failing);

  const afterFail = await pgDb
    .select()
    .from(bounceSpikeAlerts)
    .where(eq(bounceSpikeAlerts.businessId, biz.id));
  assert.equal(afterFail.length, 0, "no cooldown row on failed send");
  assert.equal(c1.filter((c) => c.businessName === "RetryAfterFail Co").length, 1);

  const { notifier: ok, calls: c2 } = makeNotifier({ succeed: true });
  await checkBounceSpikeAlerts(ok);
  assert.equal(
    c2.filter((c) => c.businessName === "RetryAfterFail Co").length,
    1,
    "retry should re-attempt exactly once",
  );

  const afterRetry = await pgDb
    .select()
    .from(bounceSpikeAlerts)
    .where(eq(bounceSpikeAlerts.businessId, biz.id));
  assert.equal(afterRetry.length, 1, "successful retry persists the cooldown row");
});

test("scopes counts per business — one tenant's spike doesn't trip another", async () => {
  const noisy = await seedBusiness("Noisy Co");
  const quiet = await seedBusiness("Quiet Co");
  createdBusinessIds.push(noisy.id, quiet.id);

  for (let i = 0; i < 5; i++)
    await seedSuppression({ businessId: noisy.id, reason: "webhook: bounced[hard]: x" });
  for (let i = 0; i < 2; i++)
    await seedSuppression({ businessId: quiet.id, reason: "webhook: bounced[hard]: x" });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);

  assert.equal(calls.filter((c) => c.businessName === "Noisy Co").length, 1);
  assert.equal(
    calls.filter((c) => c.businessName === "Quiet Co").length,
    0,
    "Quiet Co is below threshold and must not be alerted",
  );
});

test("per-business threshold override: a higher floor suppresses an alert that would otherwise fire under the env default", async () => {
  // env BOUNCE_SPIKE_THRESHOLD = 3 in this suite. A business that picks 25
  // (the "high-volume Gold" example from the task) should NOT alert at 6
  // bounces, even though the env default would have triggered.
  const biz = await seedBusiness("HighVolumeGold Co");
  createdBusinessIds.push(biz.id);
  await pgDb
    .update(businesses)
    .set({ bounceSpikeThreshold: 25 })
    .where(eq(businesses.id, biz.id));

  for (let i = 0; i < 6; i++)
    await seedSuppression({ businessId: biz.id, reason: "webhook: bounced[hard]: x" });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);

  assert.equal(
    calls.filter((c) => c.businessName === "HighVolumeGold Co").length,
    0,
    "per-business floor of 25 should swallow a 6-bounce spike",
  );

  const cooldownRows = await pgDb
    .select()
    .from(bounceSpikeAlerts)
    .where(eq(bounceSpikeAlerts.businessId, biz.id));
  assert.equal(cooldownRows.length, 0);
});

test("per-business threshold override: a lower floor (1) lets a single bounce trigger the heads-up", async () => {
  // The "small business that wants to hear about even 1 bounce" path.
  const biz = await seedBusiness("Tiny Shop");
  createdBusinessIds.push(biz.id);
  await pgDb
    .update(businesses)
    .set({ bounceSpikeThreshold: 1 })
    .where(eq(businesses.id, biz.id));

  await seedSuppression({ businessId: biz.id, reason: "webhook: bounced[hard]: x" });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);

  const ours = calls.filter((c) => c.businessName === "Tiny Shop");
  assert.equal(ours.length, 1, "threshold=1 should fire on a single bounce");
  assert.equal(ours[0].bounceCount, 1);
});

test("per-business cadence override: a slow weekly cadence keeps the second-day run silent even past the global cooldown", async () => {
  // env BOUNCE_SPIKE_COOLDOWN_HOURS = 24. Business picks 168h (weekly) —
  // an alert sent ~25h ago must NOT re-fire today.
  const biz = await seedBusiness("WeeklyDigest Co");
  createdBusinessIds.push(biz.id);
  await pgDb
    .update(businesses)
    .set({ bounceSpikeCadenceHours: 168 })
    .where(eq(businesses.id, biz.id));

  for (let i = 0; i < 5; i++)
    await seedSuppression({ businessId: biz.id, reason: "webhook: bounced[hard]: x" });

  // Pretend we already pinged this owner ~25h ago — past the env default
  // cooldown, but well inside the per-business 168h window.
  await pgDb.insert(bounceSpikeAlerts).values({
    businessId: biz.id,
    bounceCount: 5,
    alertedAt: new Date(Date.now() - 25 * 60 * 60 * 1000),
  });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);

  assert.equal(
    calls.filter((c) => c.businessName === "WeeklyDigest Co").length,
    0,
    "weekly-cadence override should keep the daily cron silent",
  );
});

test("per-business mute: muted owners get NO email and NO cooldown row, regardless of bounce count", async () => {
  const biz = await seedBusiness("MutedAlerts Co");
  createdBusinessIds.push(biz.id);
  await pgDb
    .update(businesses)
    .set({ bounceSpikeMuted: true })
    .where(eq(businesses.id, biz.id));

  // Way above any reasonable threshold — must still be silent.
  for (let i = 0; i < 50; i++)
    await seedSuppression({ businessId: biz.id, reason: "webhook: bounced[hard]: x" });

  const { notifier, calls } = makeNotifier();
  await checkBounceSpikeAlerts(notifier);

  assert.equal(calls.filter((c) => c.businessName === "MutedAlerts Co").length, 0);

  const cooldownRows = await pgDb
    .select()
    .from(bounceSpikeAlerts)
    .where(eq(bounceSpikeAlerts.businessId, biz.id));
  assert.equal(
    cooldownRows.length,
    0,
    "muted businesses should not write cooldown rows so unmuting resumes alerts immediately",
  );
});

test("a business with no owner email on file is skipped (notifier returns false; no cooldown row written)", async () => {
  const biz = await seedBusiness("NoEmail Co", null);
  createdBusinessIds.push(biz.id);

  for (let i = 0; i < 5; i++)
    await seedSuppression({ businessId: biz.id, reason: "webhook: bounced[hard]: x" });

  // The real `notifyOwnerBounceSpike` returns false when recipientEmail is
  // missing. Mirror that here so the cooldown-skip path is covered.
  const calls: AlertCall[] = [];
  const notifier: BounceSpikeOwnerNotifier = async (args) => {
    calls.push({
      recipientEmail: args.recipientEmail,
      businessName: args.businessName,
      bounceCount: args.bounceCount,
      windowHours: args.windowHours,
    });
    return args.recipientEmail ? true : false;
  };

  await checkBounceSpikeAlerts(notifier);

  assert.equal(calls.length, 1, "notifier still called so it can decide");
  assert.equal(calls[0].recipientEmail, null);

  const cooldownRows = await pgDb
    .select()
    .from(bounceSpikeAlerts)
    .where(eq(bounceSpikeAlerts.businessId, biz.id));
  assert.equal(cooldownRows.length, 0, "no cooldown row when send was skipped");
});
