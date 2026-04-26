// Tests for the newsletter SEND endpoint:
//   POST /api/businesses/:id/newsletter/campaigns/:cid/send
//
// Specifically guards the "Resend rejected the send" branch. Background:
// the Resend SDK does NOT throw on a non-2xx response — it returns
// `{ data: null, error }`. Without the explicit `if (sendResult.error)
// throw` check inside the route, every recipient would be marked 'sent'
// during a real Resend outage, the campaign would say "all delivered",
// and nobody would see anything wrong while no email actually went out.
//
// We exercise that path end-to-end by:
//   1. Setting RESEND_API_KEY in the setup shim so the route constructs
//      a real Resend client (otherwise it short-circuits to the
//      "not configured" branch, which is a different code path).
//   2. Intercepting globalThis.fetch for api.resend.com and returning
//      a 422 — the same shape the real Resend API uses for validation
//      errors. The SDK swallows that into `{ data: null, error: {...} }`
//      and our route is expected to throw → mark the row 'failed'.
import "./_newsletterSendErrorSetup";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import { eq, inArray } from "drizzle-orm";

import { db as pgDb } from "../db";
import {
  businesses,
  newsletterCampaigns,
  newsletterSubscribers,
  newsletterSends,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import { registerNewsletterRoutes } from "../newsletter";

const TEST_TAG = "__newsletter_send_error_test__";

let createdBizIds: number[] = [];
let createdUserIds: string[] = [];

// ── fetch interception for Resend ────────────────────────────────────
// `resendOutcome` flips behavior across tests:
//   - "ok"   → 200 with { id: "re_<n>" } so the row should land 'sent'
//   - "fail" → 422 with a Resend-shaped error body. The SDK turns this
//              into { data: null, error: {...} } and the route is
//              expected to inspect `error` and throw.
const realFetch = globalThis.fetch;
type FetchOutcome = "ok" | "fail";
let resendOutcome: FetchOutcome = "fail";
let resendCalls = 0;

globalThis.fetch = (async (input: any, init?: any) => {
  const urlStr = typeof input === "string" ? input : (input?.url ?? "");
  if (urlStr.includes("api.resend.com")) {
    resendCalls++;
    if (resendOutcome === "fail") {
      return new Response(
        JSON.stringify({
          name: "validation_error",
          message: "stubbed resend HTTP 422 — quota exceeded",
          statusCode: 422,
        }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ id: `re_${resendCalls}` }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }
  return realFetch(input, init);
}) as typeof fetch;

// ── Seed helpers ─────────────────────────────────────────────────────
async function seedBusiness(opts: { tier?: string } = {}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: `NL Send Err ${Date.now()}_${Math.random()}`,
      description: TEST_TAG,
      address: "1 Newsletter Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `nl_${Date.now()}_${Math.random()}@example.com`,
      // Newsletter SEND requires Gold (premium tier).
      membershipTier: opts.tier ?? "premium",
    })
    .returning();
  createdBizIds.push(row.id);
  return row;
}

async function seedUser(linkedBusinessId: number | null) {
  const [row] = await pgDb
    .insert(users)
    .values({
      email: `nlu_${Date.now()}_${Math.random()}@example.com`,
      firstName: "NL",
      lastName: "Owner",
      linkedBusinessId,
    })
    .returning();
  createdUserIds.push(row.id);
  return row;
}

async function seedCampaign(businessId: number) {
  const [row] = await pgDb
    .insert(newsletterCampaigns)
    .values({
      businessId,
      subject: "Hello from us",
      bodyHtml: "<p>Hi neighbor</p>",
      status: "draft",
    })
    .returning();
  return row;
}

async function seedSubscriber(businessId: number, email: string) {
  const [row] = await pgDb
    .insert(newsletterSubscribers)
    .values({
      businessId,
      email,
      unsubscribeToken: `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    })
    .returning();
  return row;
}

async function cleanup() {
  if (createdBizIds.length) {
    // newsletter_sends FK-cascades from campaigns/subscribers, so deleting
    // those parents wipes the children too.
    await pgDb.delete(newsletterCampaigns).where(inArray(newsletterCampaigns.businessId, createdBizIds));
    await pgDb.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.businessId, createdBizIds));
  }
  if (createdUserIds.length) {
    await pgDb.delete(users).where(inArray(users.id, createdUserIds));
    createdUserIds = [];
  }
  if (createdBizIds.length) {
    await pgDb.delete(businesses).where(inArray(businesses.id, createdBizIds));
    createdBizIds = [];
  }
}

before(async () => {
  const stragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (stragglers.length) {
    const ids = stragglers.map((s) => s.id);
    await pgDb.delete(newsletterCampaigns).where(inArray(newsletterCampaigns.businessId, ids));
    await pgDb.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(async () => {
  await cleanup();
  resendOutcome = "fail";
  resendCalls = 0;
});

after(async () => {
  await cleanup();
  globalThis.fetch = realFetch;
});

function makeApp(userId: string | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).isAuthenticated = () => !!userId;
    if (userId) (req as any).user = { id: userId };
    next();
  });
  registerNewsletterRoutes(app);
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

// ── Tests ────────────────────────────────────────────────────────────

test("newsletter send: when Resend returns an error, the send row is marked 'failed' with errorMessage captured (and is NOT silently marked 'sent')", async () => {
  // This is the regression we care about. The Resend SDK returns
  // `{ data: null, error }` on a 4xx — it does not throw. Without the
  // route's explicit `if (sendResult.error) throw new Error(...)`, the
  // catch arm never runs and the row would land 'sent' with no email
  // actually delivered. Locking the recipient into the 90-day cooldown
  // and reporting a successful campaign — the worst-case silent failure.
  const biz = await seedBusiness({ tier: "premium" });
  const owner = await seedUser(biz.id);
  const campaign = await seedCampaign(biz.id);
  const sub = await seedSubscriber(biz.id, "fan@example.com");

  resendOutcome = "fail";

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await fetch(
      `${url}/api/businesses/${biz.id}/newsletter/campaigns/${campaign.id}/send`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    assert.equal(res.status, 200, "endpoint always returns 200; per-recipient outcomes are in the body");
    const body = await res.json();
    assert.equal(body.sent, 0, "no recipient should be reported as sent");
    assert.equal(body.failed, 1, "the one recipient should be reported as failed");
  } finally {
    await close();
  }

  assert.ok(resendCalls >= 1, "Resend stub must have been hit (proves we exercised the SDK error path, not the missing-key branch)");

  // The send-row must be 'failed' with the Resend reason captured.
  const sendRows = await pgDb
    .select()
    .from(newsletterSends)
    .where(eq(newsletterSends.campaignId, campaign.id));
  assert.equal(sendRows.length, 1);
  assert.equal(sendRows[0].subscriberId, sub.id);
  assert.equal(sendRows[0].status, "failed", "row must be 'failed', NOT 'sent'");
  assert.ok(sendRows[0].errorMessage, "errorMessage must capture why the send failed");
  assert.match(
    String(sendRows[0].errorMessage),
    /quota exceeded/i,
    "errorMessage should surface Resend's reported reason for support debugging",
  );
  assert.equal(sendRows[0].messageId, null, "messageId must remain null on failure (no Resend id was issued)");

  // The campaign should also flip to 'failed' since 100% of sends failed,
  // with failureCount accurately tracking the count.
  const [campAfter] = await pgDb
    .select()
    .from(newsletterCampaigns)
    .where(eq(newsletterCampaigns.id, campaign.id));
  assert.equal(campAfter.status, "failed", "campaign must roll up to 'failed' when all sends fail");
  assert.equal(campAfter.successCount, 0);
  assert.equal(campAfter.failureCount, 1);
});

test("newsletter send: when Resend succeeds for some recipients but fails for others, per-row status reflects each transport outcome and the campaign is 'sent' (partial success is still 'sent', not 'failed')", async () => {
  // Mixed-outcome guard: the campaign should NOT roll up to 'failed' just
  // because one recipient bounced — that would mislead the owner into
  // thinking their entire blast was wasted. Only flips to 'failed' when
  // 100% of sends fail. Implementation rule: status='failed' iff
  // failed === subs.length, else 'sent'.
  const biz = await seedBusiness({ tier: "premium" });
  const owner = await seedUser(biz.id);
  const campaign = await seedCampaign(biz.id);
  const subOk = await seedSubscriber(biz.id, "ok@example.com");
  const subFail = await seedSubscriber(biz.id, "fail@example.com");

  // Toggle Resend outcome based on the recipient address. The route
  // calls Resend once per subscriber, so we can flip behavior between
  // calls by inspecting the request body's `to` field.
  globalThis.fetch = (async (input: any, init?: any) => {
    const urlStr = typeof input === "string" ? input : (input?.url ?? "");
    if (urlStr.includes("api.resend.com")) {
      resendCalls++;
      const bodyStr = init?.body ? String(init.body) : "";
      const isFailRecipient = bodyStr.includes("fail@example.com");
      if (isFailRecipient) {
        return new Response(
          JSON.stringify({
            name: "validation_error",
            message: "stubbed bounce for fail@example.com",
            statusCode: 422,
          }),
          { status: 422, headers: { "Content-Type": "application/json" } },
        );
      }
      return new Response(JSON.stringify({ id: `re_${resendCalls}` }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }
    return realFetch(input, init);
  }) as typeof fetch;

  const { url, close } = await start(makeApp(owner.id));
  try {
    const res = await fetch(
      `${url}/api/businesses/${biz.id}/newsletter/campaigns/${campaign.id}/send`,
      { method: "POST", headers: { "Content-Type": "application/json" } },
    );
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.sent, 1, "the one ok recipient should be reported as sent");
    assert.equal(body.failed, 1, "the bouncing recipient should be reported as failed");
  } finally {
    await close();
  }

  const sendRows = await pgDb
    .select()
    .from(newsletterSends)
    .where(eq(newsletterSends.campaignId, campaign.id));
  assert.equal(sendRows.length, 2);
  const okRow = sendRows.find((r) => r.subscriberId === subOk.id)!;
  const failRow = sendRows.find((r) => r.subscriberId === subFail.id)!;
  assert.equal(okRow.status, "sent");
  assert.ok(okRow.messageId, "ok row must capture Resend message id (so engagement webhooks can match back)");
  assert.ok(okRow.sentAt);
  assert.equal(failRow.status, "failed");
  assert.equal(failRow.messageId, null);
  assert.match(String(failRow.errorMessage), /fail@example\.com/);

  const [campAfter] = await pgDb
    .select()
    .from(newsletterCampaigns)
    .where(eq(newsletterCampaigns.id, campaign.id));
  assert.equal(campAfter.status, "sent", "partial-success campaign must NOT roll up to 'failed'");
  assert.equal(campAfter.successCount, 1);
  assert.equal(campAfter.failureCount, 1);
});
