// Tests for the review-request SEND endpoint:
//   POST /api/businesses/:id/review-requests/send
//
// Covers the behaviors that, if regressed, would either silently spam
// customers or silently drop campaigns:
//   1. Gold-only access (non-Gold owner -> 403 GOLD_REQUIRED)
//   2. 90-day per-customer cooldown (recent recipients excluded; if the
//      whole list is in cooldown the route returns 400)
//   3. Per-recipient row transitions to 'sent' or 'failed' depending on
//      what the (stubbed) Resend / SMS clients return, across each
//      supported channel (email, sms, both).
//   4. Input validation rejects bad channel values.
//
// We bypass passport entirely with a tiny Express middleware that fakes
// `req.isAuthenticated` and `req.user`, then mount the real route module
// on top of it. Resend AND Twilio are stubbed by intercepting global
// fetch — that lets us exercise success and failure transports without
// real network calls. The Twilio branch is selected by setting
// SMS_PROVIDER=twilio in `_reviewRequestSendSetup.ts`, which must be
// imported FIRST so the env capture inside server/sms.ts sees it.
import "./_reviewRequestSendSetup";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";

import { db as pgDb } from "../db";
import { businesses, reviews, reviewRequests } from "@shared/schema";
import { users, quoteRequests, quotes } from "@shared/models/auth";
import { registerReviewRequestRoutes } from "../reviewRequests";

const TEST_TAG = "__review_send_test__";

let createdBusinessIds: number[] = [];
let createdUserIds: string[] = [];
let createdQuoteRequestIds: number[] = [];
let createdQuoteIds: number[] = [];

// ── fetch interception for Resend + Twilio ───────────────────────────
const realFetch = globalThis.fetch;
type FetchOutcome = "ok" | "fail";
let resendOutcome: FetchOutcome = "ok";
let twilioOutcome: FetchOutcome = "ok";
let resendCalls = 0;
let twilioCalls = 0;

globalThis.fetch = (async (input: any, init?: any) => {
  const urlStr = typeof input === "string" ? input : (input?.url ?? "");
  if (urlStr.includes("api.resend.com")) {
    resendCalls++;
    if (resendOutcome === "fail") {
      // The Resend SDK swallows non-2xx responses into a returned
      // { data: null, error } object (it does NOT throw). The route is
      // expected to inspect that `error` field and mark the row 'failed';
      // returning a real HTTP error here exercises that path end-to-end.
      return new Response(
        JSON.stringify({
          name: "validation_error",
          message: "stubbed resend HTTP 422 failure",
          statusCode: 422,
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ id: `resend_${resendCalls}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  if (urlStr.includes("api.twilio.com")) {
    twilioCalls++;
    if (twilioOutcome === "fail") {
      return new Response(
        JSON.stringify({ code: 21610, message: "stubbed twilio failure" }),
        { status: 400, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ sid: `SM_${twilioCalls}` }), {
      status: 201,
      headers: { "Content-Type": "application/json" },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

// ── Seed helpers ─────────────────────────────────────────────────────
async function seedBusiness(name: string, opts: { tier?: string } = {}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `${name.replace(/\s+/g, "").toLowerCase()}@example.com`,
      membershipTier: opts.tier ?? "basic",
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function seedUser(opts: {
  email?: string;
  linkedBusinessId?: number | null;
} = {}) {
  const [row] = await pgDb
    .insert(users)
    .values({
      email: opts.email ?? `u_${Date.now()}_${Math.random()}@example.com`,
      firstName: "Test",
      lastName: "User",
      linkedBusinessId: opts.linkedBusinessId ?? null,
    })
    .returning();
  createdUserIds.push(row.id);
  return row;
}

// Make this customer "eligible" by ensuring they have a quote_request
// for which THIS business has a quote.
async function seedEligibleCustomer(opts: {
  businessId: number;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
}) {
  const customerEmail =
    opts.customerEmail ?? `c_${Date.now()}_${Math.random()}@example.com`;
  const customer = await seedUser({ email: customerEmail });
  const ownerForQuote = await seedUser({}); // dummy owner ref for quotes.user_id
  const [qr] = await pgDb
    .insert(quoteRequests)
    .values({
      userId: customer.id,
      title: "Need help",
      description: "Please quote",
      category: "Service",
      customerName: opts.customerName ?? "Test Customer",
      customerEmail,
      customerPhone: opts.customerPhone ?? null,
    })
    .returning();
  createdQuoteRequestIds.push(qr.id);
  const [q] = await pgDb
    .insert(quotes)
    .values({
      requestId: qr.id,
      businessId: opts.businessId,
      userId: ownerForQuote.id,
      amount: "100.00",
      message: "We can do it",
    })
    .returning();
  createdQuoteIds.push(q.id);
  return { customer, customerEmail };
}

async function seedPriorAsk(opts: {
  businessId: number;
  email: string;
  sentAt: Date;
}) {
  const [row] = await pgDb
    .insert(reviewRequests)
    .values({
      businessId: opts.businessId,
      recipientEmail: opts.email,
      channel: "email",
      status: "sent",
      token: `priorask_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sentAt: opts.sentAt,
    })
    .returning();
  return row;
}

async function cleanup() {
  if (createdQuoteIds.length) {
    await pgDb.delete(quotes).where(inArray(quotes.id, createdQuoteIds));
    createdQuoteIds = [];
  }
  if (createdQuoteRequestIds.length) {
    await pgDb
      .delete(quoteRequests)
      .where(inArray(quoteRequests.id, createdQuoteRequestIds));
    createdQuoteRequestIds = [];
  }
  if (createdBusinessIds.length) {
    await pgDb
      .delete(reviewRequests)
      .where(inArray(reviewRequests.businessId, createdBusinessIds));
    await pgDb
      .delete(reviews)
      .where(inArray(reviews.businessId, createdBusinessIds));
  }
  if (createdUserIds.length) {
    await pgDb.delete(users).where(inArray(users.id, createdUserIds));
    createdUserIds = [];
  }
  if (createdBusinessIds.length) {
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
    await pgDb.delete(reviewRequests).where(inArray(reviewRequests.businessId, ids));
    await pgDb.delete(reviews).where(inArray(reviews.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(async () => {
  await cleanup();
  resendOutcome = "ok";
  twilioOutcome = "ok";
  resendCalls = 0;
  twilioCalls = 0;
});

after(async () => {
  await cleanup();
  globalThis.fetch = realFetch;
});

// Build a tiny app that fakes auth as `userId`, then mounts the real
// review-request routes on top.
function makeApp(userId: string | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).isAuthenticated = () => !!userId;
    if (userId) (req as any).user = { id: userId };
    next();
  });
  registerReviewRequestRoutes(app);
  return app;
}

function start(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({
        url: `http://127.0.0.1:${port}`,
        close: () => new Promise<void>((r) => server.close(() => r())),
      });
    });
  });
}

async function postSend(
  url: string,
  businessId: number,
  body: Record<string, unknown>,
) {
  return fetch(`${url}/api/businesses/${businessId}/review-requests/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ── Tests ────────────────────────────────────────────────────────────

test("non-Gold owner gets 403 with code GOLD_REQUIRED", async () => {
  const biz = await seedBusiness("Basic Tier Co", { tier: "basic" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "fan1@example.com",
  });

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["fan1@example.com"],
      channel: "email",
      emailSubject: "Hi there",
      emailBody: "Would you mind leaving a review?",
    });
    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.code, "GOLD_REQUIRED");
  } finally {
    await close();
  }

  const rows = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.businessId, biz.id));
  assert.equal(rows.length, 0, "must not insert any rows when access is denied");
});

test("recipients within the 90-day cooldown are excluded; if all selected are in cooldown the call returns 400", async () => {
  const biz = await seedBusiness("Gold Cooldown Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "recent@example.com",
  });
  await seedPriorAsk({
    businessId: biz.id,
    email: "recent@example.com",
    sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  });

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["recent@example.com"],
      channel: "email",
      emailSubject: "Quick favor",
      emailBody: "Mind leaving a review?",
    });
    assert.equal(res.status, 400, "blast must be rejected — nobody is eligible");
    const body = await res.json();
    assert.match(String(body.message), /cooldown/i);
  } finally {
    await close();
  }

  const rows = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.businessId, biz.id));
  assert.equal(rows.length, 1, "no new outreach should have been written");
  assert.equal(rows[0].status, "sent", "the prior ask remains untouched");
});

test("partial cooldown: a fresh recipient sends successfully even when a real cooldowned sibling is also selected (cooldownExcluded math is correct)", async () => {
  const biz = await seedBusiness("Gold Partial Cooldown Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "fresh@example.com",
  });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "recent@example.com",
  });
  await seedPriorAsk({
    businessId: biz.id,
    email: "recent@example.com",
    sentAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000),
  });

  resendOutcome = "ok";

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["fresh@example.com", "recent@example.com"],
      channel: "email",
      emailSubject: "Hi there",
      emailBody: "Mind leaving us a quick review?",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, 1, "the fresh recipient should send successfully");
    assert.equal(body.failure, 0);
    assert.equal(body.skipped, 0);
    assert.equal(
      body.cooldownExcluded,
      1,
      "the cooldowned sibling must be reported as excluded — proves the math survives partial blasts",
    );
  } finally {
    await close();
  }

  const rows = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.businessId, biz.id));
  const fresh = rows.filter((r) => r.recipientEmail === "fresh@example.com");
  assert.equal(fresh.length, 1, "only the fresh recipient should get a new row");
  assert.equal(fresh[0].status, "sent");
  assert.ok(fresh[0].sentAt);
  const recent = rows.filter((r) => r.recipientEmail === "recent@example.com");
  assert.equal(recent.length, 1, "the prior cooldown ask remains untouched (no new row)");
});

// ── Email channel ────────────────────────────────────────────────────

test("[email] success: row is marked 'sent' with sentAt stamped and recipientEmail set", async () => {
  const biz = await seedBusiness("Gold Email Success Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "happy@example.com",
  });

  resendOutcome = "ok";

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["happy@example.com"],
      channel: "email",
      emailSubject: "Loved having you",
      emailBody: "Would you leave us a quick review?",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, 1);
    assert.equal(body.failure, 0);
  } finally {
    await close();
  }

  assert.ok(resendCalls >= 1, "Resend stub should have been hit");
  assert.equal(twilioCalls, 0, "no Twilio calls on email-only channel");

  const rows = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.businessId, biz.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "sent");
  assert.equal(rows[0].recipientEmail, "happy@example.com");
  assert.equal(rows[0].recipientPhone, null);
  assert.equal(rows[0].channel, "email");
  assert.ok(rows[0].sentAt, "sentAt must be stamped on success");
  assert.equal(rows[0].errorMsg, null);
});

test("[email] failure: row is marked 'failed' with errorMsg captured and sentAt left null", async () => {
  const biz = await seedBusiness("Gold Email Fail Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "bouncy@example.com",
  });

  // The Resend SDK swallows non-2xx responses into a returned
  // { data: null, error } object — it does NOT throw. The route must
  // inspect that `error` field; otherwise a real Resend outage would
  // mark every recipient 'sent' and lock them out of the 90-day
  // cooldown without any email actually going out.
  resendOutcome = "fail";

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["bouncy@example.com"],
      channel: "email",
      emailSubject: "Hi again",
      emailBody: "Would you mind leaving a review?",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, 0);
    assert.equal(body.failure, 1);
  } finally {
    await close();
  }

  assert.ok(resendCalls >= 1, "Resend stub must have been hit (proves we exercised the SDK error path, not the missing-key branch)");

  const rows = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.businessId, biz.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "failed");
  assert.equal(rows[0].sentAt, null, "sentAt must remain null on failure (so cooldown is not triggered)");
  assert.ok(rows[0].errorMsg, "errorMsg must capture why the send failed");
  assert.match(String(rows[0].errorMsg), /email/i);
  assert.match(
    String(rows[0].errorMsg),
    /stubbed resend HTTP 422 failure/,
    "errorMsg should surface the Resend-reported reason so owners can debug",
  );
});

// ── SMS channel ──────────────────────────────────────────────────────

test("[sms] success: row is marked 'sent' with recipientPhone set and no email touched", async () => {
  const biz = await seedBusiness("Gold SMS Success Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "sms_happy@example.com",
    customerPhone: "+15555550111",
  });

  twilioOutcome = "ok";

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["sms_happy@example.com"],
      channel: "sms",
      smsBody: "We loved having you — would you leave us a review?",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, 1);
    assert.equal(body.failure, 0);
  } finally {
    await close();
  }

  assert.ok(twilioCalls >= 1, "Twilio stub should have been hit");
  assert.equal(resendCalls, 0, "no Resend calls on sms-only channel");

  const rows = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.businessId, biz.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "sent");
  assert.equal(rows[0].channel, "sms");
  assert.equal(rows[0].recipientPhone, "+15555550111");
  assert.equal(rows[0].recipientEmail, null, "email column must NOT be set on sms-only sends");
  assert.ok(rows[0].sentAt);
  assert.equal(rows[0].errorMsg, null);
});

test("[sms] failure: row is marked 'failed' with sms-flavored errorMsg and sentAt null", async () => {
  const biz = await seedBusiness("Gold SMS Fail Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "sms_bouncy@example.com",
    customerPhone: "+15555550222",
  });

  twilioOutcome = "fail";

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["sms_bouncy@example.com"],
      channel: "sms",
      smsBody: "We loved having you — would you leave us a review?",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, 0);
    assert.equal(body.failure, 1);
  } finally {
    await close();
  }

  const rows = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.businessId, biz.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "failed");
  assert.equal(rows[0].sentAt, null);
  assert.ok(rows[0].errorMsg, "errorMsg must capture why the send failed");
  assert.match(String(rows[0].errorMsg), /sms/i);
});

// ── Both-channel (email + sms) ───────────────────────────────────────

test("[both] full success: both transports fire, row marked 'sent' with email AND phone recorded", async () => {
  const biz = await seedBusiness("Gold Both Success Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "both_happy@example.com",
    customerPhone: "+15555550333",
  });

  resendOutcome = "ok";
  twilioOutcome = "ok";

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["both_happy@example.com"],
      channel: "both",
      emailSubject: "Loved having you",
      emailBody: "Mind leaving a quick review?",
      smsBody: "Mind leaving a quick review?",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, 1);
    assert.equal(body.failure, 0);
  } finally {
    await close();
  }

  assert.ok(resendCalls >= 1, "Resend should have been called for the email leg");
  assert.ok(twilioCalls >= 1, "Twilio should have been called for the sms leg");

  const rows = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.businessId, biz.id));
  assert.equal(rows.length, 1);
  assert.equal(rows[0].status, "sent");
  assert.equal(rows[0].channel, "both");
  assert.equal(rows[0].recipientEmail, "both_happy@example.com");
  assert.equal(rows[0].recipientPhone, "+15555550333");
  assert.ok(rows[0].sentAt);
});

test("[both] mixed: when SMS fails but email succeeds, the row is still marked 'failed' (we don't claim success on partial delivery)", async () => {
  const biz = await seedBusiness("Gold Both Mixed Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  await seedEligibleCustomer({
    businessId: biz.id,
    customerEmail: "both_mixed@example.com",
    customerPhone: "+15555550444",
  });

  resendOutcome = "ok";
  twilioOutcome = "fail";

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["both_mixed@example.com"],
      channel: "both",
      emailSubject: "Loved having you",
      emailBody: "Mind leaving a quick review?",
      smsBody: "Mind leaving a quick review?",
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, 0);
    assert.equal(body.failure, 1);
  } finally {
    await close();
  }

  assert.ok(resendCalls >= 1);
  assert.ok(twilioCalls >= 1);

  const rows = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.businessId, biz.id));
  assert.equal(rows.length, 1);
  assert.equal(
    rows[0].status,
    "failed",
    "partial delivery (email ok, sms broken) must be recorded as failed so the cooldown does NOT lock this customer out for 90 days",
  );
  assert.equal(
    rows[0].sentAt,
    null,
    "sentAt must remain null so the customer can be re-asked once the failing channel recovers",
  );
  assert.ok(rows[0].errorMsg);
  assert.match(String(rows[0].errorMsg), /sms/i);
});

// ── Input validation ─────────────────────────────────────────────────

// Regression for the eligible-customers sort crash. Previously the
// comparator called `.getTime()` directly on `lastInteractionAt`, which
// arrived as a string in some code paths (raw `pgDb.execute(sql\`…\`)`
// hands back string timestamps under certain pg setups). Two or more
// eligible customers crashed the route. With the toMs() coercion the
// route should sort and send to all of them, AND the response should
// include per-recipient `failures` for any that the transport rejected.
test("regression: 2+ eligible customers do not crash the sort, and per-recipient failures are returned", async () => {
  const biz = await seedBusiness("Multi Eligible Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  const { customerEmail: e1 } = await seedEligibleCustomer({ businessId: biz.id, customerName: "Alpha" });
  const { customerEmail: e2 } = await seedEligibleCustomer({ businessId: biz.id, customerName: "Bravo" });
  const { customerEmail: e3 } = await seedEligibleCustomer({ businessId: biz.id, customerName: "Charlie" });

  // Make Bravo's send fail by toggling the resend stub mid-loop is
  // brittle; simpler: send all three with stub OK, then verify all
  // succeed and `failures` is empty (proves the sort worked + response
  // shape includes the new field).
  resendOutcome = "ok";
  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: [e1, e2, e3],
      channel: "email",
      emailSubject: "We'd love your review",
      emailBody: "Thanks for working with us — would you mind leaving a quick review?",
    });
    assert.equal(res.status, 200, "endpoint must not crash with multiple eligible customers");
    const body = (await res.json()) as {
      success: number;
      failure: number;
      failures: Array<{ key: string; errorMsg: string }>;
    };
    assert.equal(body.success, 3, "all three sends should succeed");
    assert.equal(body.failure, 0);
    assert.deepEqual(body.failures, [], "no failures expected on all-OK transport");
  } finally {
    await close();
  }
});

test("regression: failed sends are itemized in the response with errorMsg per recipient", async () => {
  const biz = await seedBusiness("Itemized Failures Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });
  const { customerEmail: e1 } = await seedEligibleCustomer({ businessId: biz.id, customerName: "Alpha" });
  const { customerEmail: e2 } = await seedEligibleCustomer({ businessId: biz.id, customerName: "Bravo" });

  resendOutcome = "fail"; // every email send returns Resend HTTP 422
  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: [e1, e2],
      channel: "email",
      emailSubject: "We'd love your review",
      emailBody: "Thanks for working with us — please leave a quick review.",
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as {
      success: number;
      failure: number;
      failures: Array<{ key: string; contact: string | null; channel: string; errorMsg: string }>;
    };
    assert.equal(body.success, 0);
    assert.equal(body.failure, 2);
    assert.equal(body.failures.length, 2, "every failed recipient is in the failures array");
    for (const f of body.failures) {
      assert.ok(f.contact, "contact (email/phone) is reported");
      assert.equal(f.channel, "email");
      assert.match(f.errorMsg, /email:.*stubbed resend HTTP 422/);
    }
    const reportedKeys = new Set(body.failures.map((f) => f.key));
    assert.ok(reportedKeys.has(e1) && reportedKeys.has(e2));
  } finally {
    await close();
  }
});

test("invalid channel value is rejected by the input schema (400)", async () => {
  const biz = await seedBusiness("Gold Validation Co", { tier: "premium" });
  const owner = await seedUser({ linkedBusinessId: biz.id });

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await postSend(url, biz.id, {
      customerKeys: ["whoever@example.com"],
      channel: "carrier-pigeon",
      emailSubject: "x",
      emailBody: "ok ok ok ok ok",
    });
    assert.equal(res.status, 400);
  } finally {
    await close();
  }
});
