// Disable real email sending before any module loads — same pattern as the
// sibling comp-expiry tests. The alert job uses an injected notifier, but
// other code paths pulled in via `import "../routes"` may still touch
// Resend during module init.
process.env.RESEND_API_KEY = "";
// Make the env-tunable knobs deterministic for this suite. We deliberately
// keep MIN_VOLUME small so seeded fixtures stay readable; the production
// default (10) is asserted indirectly by the "small sample is ignored" test
// below where we override it back to 10.
process.env.BOUNCE_RATE_THRESHOLD_PCT = "10";
process.env.BOUNCE_RATE_SAMPLE_SIZE = "100";
process.env.BOUNCE_RATE_LOOKBACK_HOURS = "24";
process.env.BOUNCE_RATE_MIN_VOLUME = "5";
process.env.BOUNCE_RATE_COOLDOWN_HOURS = "24";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import crypto from "crypto";

import { db as pgDb } from "../db";
import { businesses, reviewRequests, bounceRateAlerts } from "@shared/schema";
import {
  checkBounceRateAlerts,
  type BounceRateSpikeNotifier,
} from "../routes";

const TEST_TAG = "__bouncerate_alert_test__";

type AlertCall = {
  businessId: number;
  businessName: string;
  bounceCount: number;
  totalCount: number;
  bounceRatePct: number;
  thresholdPct: number;
};

function makeNotifier(opts: { succeed?: boolean } = {}) {
  const succeed = opts.succeed ?? true;
  const calls: AlertCall[] = [];
  const notifier: BounceRateSpikeNotifier = async (args) => {
    calls.push({
      businessId: args.businessId,
      businessName: args.businessName,
      bounceCount: args.bounceCount,
      totalCount: args.totalCount,
      bounceRatePct: args.bounceRatePct,
      thresholdPct: args.thresholdPct,
    });
    return succeed;
  };
  return { notifier, calls };
}

async function seedBusiness(name: string) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: "owner@example.com",
      membershipTier: "premium",
    })
    .returning();
  return row;
}

async function seedRequest(opts: {
  businessId: number;
  status: "sent" | "failed" | "queued" | "clicked" | "completed";
  errorMsg?: string | null;
  channel?: "email" | "both" | "sms";
  ageMinutes?: number;
}) {
  const ageMs = (opts.ageMinutes ?? 60) * 60 * 1000;
  const ts = new Date(Date.now() - ageMs);
  await pgDb.insert(reviewRequests).values({
    businessId: opts.businessId,
    recipientEmail: `r-${crypto.randomBytes(4).toString("hex")}@example.com`,
    channel: opts.channel ?? "email",
    status: opts.status,
    token: crypto.randomBytes(8).toString("hex"),
    errorMsg: opts.errorMsg ?? null,
    sentAt: opts.status === "sent" || opts.status === "clicked" || opts.status === "completed" ? ts : null,
    createdAt: ts,
  });
}

let createdBusinessIds: number[] = [];

async function cleanup() {
  if (createdBusinessIds.length === 0) return;
  await pgDb
    .delete(bounceRateAlerts)
    .where(inArray(bounceRateAlerts.businessId, createdBusinessIds));
  await pgDb
    .delete(reviewRequests)
    .where(inArray(reviewRequests.businessId, createdBusinessIds));
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
    await pgDb.delete(bounceRateAlerts).where(inArray(bounceRateAlerts.businessId, ids));
    await pgDb.delete(reviewRequests).where(inArray(reviewRequests.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
  delete process.env.BOUNCE_RATE_THRESHOLD_PCT;
  delete process.env.BOUNCE_RATE_SAMPLE_SIZE;
  delete process.env.BOUNCE_RATE_LOOKBACK_HOURS;
  delete process.env.BOUNCE_RATE_MIN_VOLUME;
  delete process.env.BOUNCE_RATE_COOLDOWN_HOURS;
});

test("emits an alert when permanent-bounce rate exceeds the threshold and persists a cooldown row", async () => {
  const biz = await seedBusiness("HighBounce Co");
  createdBusinessIds.push(biz.id);

  // 8 sent + 2 permanent bounces = 20% > 10% threshold, total 10 > minVolume(5)
  for (let i = 0; i < 8; i++) await seedRequest({ businessId: biz.id, status: "sent" });
  for (let i = 0; i < 2; i++)
    await seedRequest({
      businessId: biz.id,
      status: "failed",
      errorMsg: "email[permanent]: bounced[hard]: mailbox does not exist",
    });

  const { notifier, calls } = makeNotifier();
  await checkBounceRateAlerts(notifier);

  const ours = calls.filter((c) => c.businessId === biz.id);
  assert.equal(ours.length, 1, "exactly one alert should fire");
  assert.equal(ours[0].bounceCount, 2);
  assert.equal(ours[0].totalCount, 10);
  assert.equal(ours[0].bounceRatePct, 20);
  assert.equal(ours[0].thresholdPct, 10);

  const cooldownRows = await pgDb
    .select()
    .from(bounceRateAlerts)
    .where(eq(bounceRateAlerts.businessId, biz.id));
  assert.equal(cooldownRows.length, 1, "cooldown row should be persisted");
  assert.equal(cooldownRows[0].bounceCount, 2);
  assert.equal(cooldownRows[0].totalCount, 10);
  assert.equal(cooldownRows[0].bounceRateBp, 2000);
});

test("does NOT alert when bounce rate is at or below the threshold", async () => {
  const biz = await seedBusiness("Healthy Co");
  createdBusinessIds.push(biz.id);

  // 9 sent + 1 permanent bounce = 10% — at the threshold, NOT above
  for (let i = 0; i < 9; i++) await seedRequest({ businessId: biz.id, status: "sent" });
  await seedRequest({
    businessId: biz.id,
    status: "failed",
    errorMsg: "email[permanent]: bounced[hard]: nope",
  });

  const { notifier, calls } = makeNotifier();
  await checkBounceRateAlerts(notifier);

  assert.equal(
    calls.filter((c) => c.businessId === biz.id).length,
    0,
    "no alert at exactly threshold (10%)",
  );
});

test("ignores tiny samples below the minimum-volume floor (1/3 = 33% must NOT fire)", async () => {
  // Override min volume back to production default for this test
  process.env.BOUNCE_RATE_MIN_VOLUME = "10";
  const biz = await seedBusiness("Tiny Sample Co");
  createdBusinessIds.push(biz.id);

  await seedRequest({ businessId: biz.id, status: "sent" });
  await seedRequest({ businessId: biz.id, status: "sent" });
  await seedRequest({
    businessId: biz.id,
    status: "failed",
    errorMsg: "email[permanent]: bounced[hard]: x",
  });

  const { notifier, calls } = makeNotifier();
  await checkBounceRateAlerts(notifier);
  process.env.BOUNCE_RATE_MIN_VOLUME = "5"; // restore for sibling tests

  assert.equal(calls.filter((c) => c.businessId === biz.id).length, 0);
});

test("ignores soft-bounce / generic failures — only `email[permanent]:` counts", async () => {
  const biz = await seedBusiness("SoftBounce Co");
  createdBusinessIds.push(biz.id);

  for (let i = 0; i < 7; i++) await seedRequest({ businessId: biz.id, status: "sent" });
  // Soft / generic failures — must NOT count as bounces
  for (let i = 0; i < 3; i++)
    await seedRequest({
      businessId: biz.id,
      status: "failed",
      errorMsg: "email: temporary failure, please retry",
    });

  const { notifier, calls } = makeNotifier();
  await checkBounceRateAlerts(notifier);

  assert.equal(
    calls.filter((c) => c.businessId === biz.id).length,
    0,
    "soft bounces must not trip the spike alert",
  );
});

test("ignores rows older than the lookback window", async () => {
  const biz = await seedBusiness("Stale Bounces Co");
  createdBusinessIds.push(biz.id);

  // All bounces are 3 days old — outside the 24h lookback
  for (let i = 0; i < 10; i++)
    await seedRequest({
      businessId: biz.id,
      status: "failed",
      errorMsg: "email[permanent]: bounced[hard]: x",
      ageMinutes: 3 * 24 * 60,
    });

  const { notifier, calls } = makeNotifier();
  await checkBounceRateAlerts(notifier);

  assert.equal(calls.filter((c) => c.businessId === biz.id).length, 0);
});

test("idempotent within the cooldown window — running twice does not double-alert", async () => {
  const biz = await seedBusiness("Cooldown Co");
  createdBusinessIds.push(biz.id);

  for (let i = 0; i < 6; i++) await seedRequest({ businessId: biz.id, status: "sent" });
  for (let i = 0; i < 4; i++)
    await seedRequest({
      businessId: biz.id,
      status: "failed",
      errorMsg: "email[permanent]: bounced[hard]: x",
    });

  const { notifier, calls } = makeNotifier();
  await checkBounceRateAlerts(notifier);
  await checkBounceRateAlerts(notifier);

  assert.equal(
    calls.filter((c) => c.businessId === biz.id).length,
    1,
    "second run within cooldown must be a no-op",
  );

  const cooldownRows = await pgDb
    .select()
    .from(bounceRateAlerts)
    .where(eq(bounceRateAlerts.businessId, biz.id));
  assert.equal(cooldownRows.length, 1, "still only one cooldown row");
});

test("when notifier reports failure the cooldown row is NOT persisted, so the next run retries", async () => {
  const biz = await seedBusiness("RetryAfterFailure Co");
  createdBusinessIds.push(biz.id);

  for (let i = 0; i < 6; i++) await seedRequest({ businessId: biz.id, status: "sent" });
  for (let i = 0; i < 4; i++)
    await seedRequest({
      businessId: biz.id,
      status: "failed",
      errorMsg: "email[permanent]: bounced[hard]: x",
    });

  const { notifier: failing, calls: c1 } = makeNotifier({ succeed: false });
  await checkBounceRateAlerts(failing);

  const afterFailure = await pgDb
    .select()
    .from(bounceRateAlerts)
    .where(eq(bounceRateAlerts.businessId, biz.id));
  assert.equal(afterFailure.length, 0, "no cooldown row on failed send");
  assert.equal(c1.filter((c) => c.businessId === biz.id).length, 1);

  const { notifier: ok, calls: c2 } = makeNotifier({ succeed: true });
  await checkBounceRateAlerts(ok);
  assert.equal(
    c2.filter((c) => c.businessId === biz.id).length,
    1,
    "retry should re-attempt exactly once",
  );

  const afterRetry = await pgDb
    .select()
    .from(bounceRateAlerts)
    .where(eq(bounceRateAlerts.businessId, biz.id));
  assert.equal(afterRetry.length, 1, "successful retry persists the cooldown row");
});

test("queued (un-sent) rows do NOT dilute the bounce rate — only attempted sends count toward the denominator", async () => {
  const biz = await seedBusiness("QueuedBacklog Co");
  createdBusinessIds.push(biz.id);

  // Real attempted sends: 6 successful + 4 hard bounces = 4/10 = 40% (above 10%)
  for (let i = 0; i < 6; i++) await seedRequest({ businessId: biz.id, status: "sent" });
  for (let i = 0; i < 4; i++)
    await seedRequest({
      businessId: biz.id,
      status: "failed",
      errorMsg: "email[permanent]: bounced[hard]: x",
    });
  // Plus a backlog of 90 still-queued rows that have NEVER hit Resend.
  // If the denominator counted these, the rate would collapse to 4/100 = 4%
  // and the alert would not fire. The job must ignore them.
  for (let i = 0; i < 90; i++) await seedRequest({ businessId: biz.id, status: "queued" });

  const { notifier, calls } = makeNotifier();
  await checkBounceRateAlerts(notifier);

  const ours = calls.filter((c) => c.businessId === biz.id);
  assert.equal(ours.length, 1, "queued rows must not suppress the alert");
  assert.equal(ours[0].totalCount, 10, "denominator should be the 10 attempted sends, not 100");
  assert.equal(ours[0].bounceCount, 4);
  assert.equal(ours[0].bounceRatePct, 40);
});

test("ignores SMS-only review requests (channel='sms')", async () => {
  const biz = await seedBusiness("SmsOnly Co");
  createdBusinessIds.push(biz.id);

  // Even a 100% bounce rate on SMS rows must not trigger an EMAIL bounce alert.
  for (let i = 0; i < 10; i++)
    await seedRequest({
      businessId: biz.id,
      channel: "sms",
      status: "failed",
      errorMsg: "email[permanent]: should be irrelevant since channel is sms",
    });

  const { notifier, calls } = makeNotifier();
  await checkBounceRateAlerts(notifier);

  assert.equal(calls.filter((c) => c.businessId === biz.id).length, 0);
});
