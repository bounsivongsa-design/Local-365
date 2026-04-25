// Tests for the Resend webhook handler:
//   POST /api/webhooks/resend
//
// These verify the asynchronous bounce/complaint handling that protects
// us from the Resend SDK's "200 OK now, hard-bounce later" behavior:
//   1. Missing / invalid Svix signatures are rejected (no DB writes).
//   2. A `email.bounced` (Permanent) event for a known address records a
//      per-business suppression and flips the matching review_request to
//      'failed' with an `email[permanent]:` errorMsg.
//   3. A `email.bounced` (Transient/soft) event is ignored — no
//      suppression, no row mutation.
//   4. A `email.complained` event is treated as permanent.
//
// The route is mounted on a tiny Express app that mirrors server/index.ts:
// it captures `req.rawBody` so the svix verifier can hash the exact bytes
// the webhook would receive in production.

process.env.RESEND_WEBHOOK_SECRET =
  process.env.RESEND_WEBHOOK_SECRET || "whsec_dGVzdF9zZWNyZXRfMTIzNDU2Nzg5MA==";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";
import crypto from "crypto";
import { eq, inArray, and } from "drizzle-orm";

import { db as pgDb } from "../db";
import {
  businesses,
  reviewRequests,
  recipientSuppressions,
  newsletterCampaigns,
  newsletterSubscribers,
  newsletterSends,
} from "@shared/schema";
import { registerReviewRequestRoutes } from "../reviewRequests";

const TEST_TAG = "__resend_webhook_test__";
let createdBusinessIds: number[] = [];

async function seedBusiness(name: string) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name,
      description: TEST_TAG,
      address: "1 Webhook Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `${name.replace(/\s+/g, "").toLowerCase()}@example.com`,
      membershipTier: "premium",
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function seedSentRequest(opts: {
  businessId: number;
  email: string;
  status?: string;
}) {
  const [row] = await pgDb
    .insert(reviewRequests)
    .values({
      businessId: opts.businessId,
      recipientEmail: opts.email,
      channel: "email",
      status: opts.status ?? "sent",
      token: `wh_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sentAt: new Date(),
    })
    .returning();
  return row;
}

async function cleanup() {
  if (createdBusinessIds.length) {
    await pgDb
      .delete(reviewRequests)
      .where(inArray(reviewRequests.businessId, createdBusinessIds));
    await pgDb
      .delete(recipientSuppressions)
      .where(inArray(recipientSuppressions.businessId, createdBusinessIds));
    // newsletter_sends cascades from campaigns/subscribers, but we delete
    // the parents anyway. Order matters because of FK refs.
    await pgDb
      .delete(newsletterCampaigns)
      .where(inArray(newsletterCampaigns.businessId, createdBusinessIds));
    await pgDb
      .delete(newsletterSubscribers)
      .where(inArray(newsletterSubscribers.businessId, createdBusinessIds));
    await pgDb
      .delete(businesses)
      .where(inArray(businesses.id, createdBusinessIds));
    createdBusinessIds = [];
  }
}

async function seedNewsletterSend(opts: {
  businessId: number;
  messageId: string;
  openedAt?: Date | null;
  clickedAt?: Date | null;
}) {
  const [campaign] = await pgDb
    .insert(newsletterCampaigns)
    .values({
      businessId: opts.businessId,
      subject: "Engagement test",
      bodyHtml: "<p>x</p>",
      status: "sent",
      recipientCount: 1,
      successCount: 1,
      failureCount: 0,
      sentAt: new Date(),
    })
    .returning();
  const [sub] = await pgDb
    .insert(newsletterSubscribers)
    .values({
      businessId: opts.businessId,
      email: `eng_${Date.now()}_${Math.random()}@example.com`,
      unsubscribeToken: `tok_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    })
    .returning();
  const [send] = await pgDb
    .insert(newsletterSends)
    .values({
      campaignId: campaign.id,
      subscriberId: sub.id,
      status: "sent",
      sentAt: new Date(),
      messageId: opts.messageId,
      openedAt: opts.openedAt ?? null,
      clickedAt: opts.clickedAt ?? null,
    })
    .returning();
  return { campaign, sub, send };
}

async function postSigned(url: string, body: object) {
  const payload = JSON.stringify(body);
  const headers = signPayload(process.env.RESEND_WEBHOOK_SECRET!, payload);
  return fetch(`${url}/api/webhooks/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: payload,
  });
}

before(async () => {
  const stragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (stragglers.length) {
    const ids = stragglers.map((s) => s.id);
    await pgDb
      .delete(reviewRequests)
      .where(inArray(reviewRequests.businessId, ids));
    await pgDb
      .delete(recipientSuppressions)
      .where(inArray(recipientSuppressions.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(cleanup);
after(cleanup);

function makeApp() {
  const app = express();
  // Mirror server/index.ts: capture rawBody on JSON requests so svix can
  // verify the signature against the exact bytes that were sent.
  app.use(
    express.json({
      verify: (req, _res, buf) => {
        (req as any).rawBody = buf;
      },
    }),
  );
  registerReviewRequestRoutes(app);
  return app;
}

function start(
  app: express.Express,
): Promise<{ url: string; close: () => Promise<void> }> {
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

// Sign a payload exactly the way Svix does (and how Resend will sign in
// production). Lets us exercise the verifier without real network calls.
function signPayload(secret: string, payload: string) {
  const id = `msg_${crypto.randomBytes(8).toString("hex")}`;
  const timestamp = Math.floor(Date.now() / 1000).toString();
  // Strip "whsec_" prefix and base64-decode to get the signing key bytes.
  const keyB64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const keyBytes = Buffer.from(keyB64, "base64");
  const toSign = `${id}.${timestamp}.${payload}`;
  const sig = crypto
    .createHmac("sha256", keyBytes)
    .update(toSign)
    .digest("base64");
  return {
    "svix-id": id,
    "svix-timestamp": timestamp,
    "svix-signature": `v1,${sig}`,
  };
}

async function postEvent(
  url: string,
  body: object,
  headers: Record<string, string> = {},
) {
  const payload = JSON.stringify(body);
  return fetch(`${url}/api/webhooks/resend`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: payload,
  });
}

test("webhook rejects requests without a valid signature", async () => {
  const app = makeApp();
  const server = await start(app);
  try {
    const biz = await seedBusiness("Sig Reject Co");
    const req = await seedSentRequest({
      businessId: biz.id,
      email: "noverify@example.com",
    });

    const res = await postEvent(server.url, {
      type: "email.bounced",
      data: {
        to: ["noverify@example.com"],
        bounce: { type: "Permanent", message: "User unknown" },
      },
    });
    assert.equal(res.status, 401);

    // The review_request row must NOT have been mutated.
    const [after] = await pgDb
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.id, req.id));
    assert.equal(after.status, "sent");
    assert.equal(after.errorMsg, null);

    // No suppression should have been recorded.
    const supps = await pgDb
      .select()
      .from(recipientSuppressions)
      .where(eq(recipientSuppressions.businessId, biz.id));
    assert.equal(supps.length, 0);
  } finally {
    await server.close();
  }
});

test("hard bounce records suppression and marks the matching request 'failed' with email[permanent]:", async () => {
  const app = makeApp();
  const server = await start(app);
  try {
    const biz = await seedBusiness("Bounce Co");
    const req = await seedSentRequest({
      businessId: biz.id,
      email: "dead@example.com",
    });

    const body = {
      type: "email.bounced",
      data: {
        email_id: "re_xxx",
        from: "x@y.com",
        to: ["dead@example.com"],
        bounce: {
          type: "Permanent",
          subType: "General",
          message: "smtp; 550 user unknown",
        },
      },
    };
    const payload = JSON.stringify(body);
    const headers = signPayload(process.env.RESEND_WEBHOOK_SECRET!, payload);
    const res = await fetch(`${server.url}/api/webhooks/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: payload,
    });
    assert.equal(res.status, 200);
    const json = (await res.json()) as any;
    assert.equal(json.suppressed, 1);
    assert.equal(json.updated, 1);

    const [updated] = await pgDb
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.id, req.id));
    assert.equal(updated.status, "failed");
    assert.ok(
      updated.errorMsg?.startsWith("email[permanent]:"),
      `expected errorMsg to start with email[permanent]:, got ${updated.errorMsg}`,
    );

    const [supp] = await pgDb
      .select()
      .from(recipientSuppressions)
      .where(
        and(
          eq(recipientSuppressions.businessId, biz.id),
          eq(recipientSuppressions.contact, "dead@example.com"),
        ),
      );
    assert.ok(supp, "suppression row should have been inserted");
    assert.equal(supp.contactType, "email");
  } finally {
    await server.close();
  }
});

test("soft (transient) bounce is ignored — no suppression, no row change", async () => {
  const app = makeApp();
  const server = await start(app);
  try {
    const biz = await seedBusiness("Soft Bounce Co");
    const req = await seedSentRequest({
      businessId: biz.id,
      email: "tempfail@example.com",
    });

    const body = {
      type: "email.bounced",
      data: {
        to: ["tempfail@example.com"],
        bounce: { type: "Transient", message: "mailbox full" },
      },
    };
    const payload = JSON.stringify(body);
    const headers = signPayload(process.env.RESEND_WEBHOOK_SECRET!, payload);
    const res = await fetch(`${server.url}/api/webhooks/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: payload,
    });
    assert.equal(res.status, 200);

    const [unchanged] = await pgDb
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.id, req.id));
    assert.equal(unchanged.status, "sent");
    assert.equal(unchanged.errorMsg, null);

    const supps = await pgDb
      .select()
      .from(recipientSuppressions)
      .where(eq(recipientSuppressions.businessId, biz.id));
    assert.equal(supps.length, 0);
  } finally {
    await server.close();
  }
});

test("email.opened stamps openedAt on the matching newsletter_send (matched by message_id)", async () => {
  const app = makeApp();
  const server = await start(app);
  try {
    const biz = await seedBusiness("Open Co");
    const messageId = `re_open_${Date.now()}`;
    const { send } = await seedNewsletterSend({ businessId: biz.id, messageId });

    const res = await postSigned(server.url, {
      type: "email.opened",
      data: { email_id: messageId, to: ["reader@example.com"] },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.stamped, 1);

    const [updated] = await pgDb
      .select()
      .from(newsletterSends)
      .where(eq(newsletterSends.id, send.id));
    assert.ok(updated.openedAt, "openedAt should have been stamped");
    assert.equal(updated.clickedAt, null, "clickedAt must remain untouched");
  } finally {
    await server.close();
  }
});

test("email.clicked stamps clickedAt and is first-touch (idempotent on re-fire)", async () => {
  const app = makeApp();
  const server = await start(app);
  try {
    const biz = await seedBusiness("Click Co");
    const messageId = `re_click_${Date.now()}`;
    const { send } = await seedNewsletterSend({ businessId: biz.id, messageId });

    // First click — should stamp.
    const res1 = await postSigned(server.url, {
      type: "email.clicked",
      data: { email_id: messageId },
    });
    assert.equal(res1.status, 200);
    assert.equal(((await res1.json()) as any).stamped, 1);

    const [afterFirst] = await pgDb
      .select()
      .from(newsletterSends)
      .where(eq(newsletterSends.id, send.id));
    const firstClickAt = afterFirst.clickedAt;
    assert.ok(firstClickAt, "first click should have stamped clickedAt");

    // Second click — must NOT overwrite the first-touch timestamp.
    // Wait a tick so a buggy implementation that re-stamps would produce
    // a different timestamp we can detect.
    await new Promise((r) => setTimeout(r, 50));
    const res2 = await postSigned(server.url, {
      type: "email.clicked",
      data: { email_id: messageId },
    });
    assert.equal(res2.status, 200);
    assert.equal(
      ((await res2.json()) as any).stamped,
      0,
      "second click must be a no-op (first-touch wins)",
    );

    const [afterSecond] = await pgDb
      .select()
      .from(newsletterSends)
      .where(eq(newsletterSends.id, send.id));
    assert.equal(
      afterSecond.clickedAt?.getTime(),
      firstClickAt!.getTime(),
      "clickedAt must equal the first-touch timestamp",
    );
  } finally {
    await server.close();
  }
});

test("engagement event with no message_id match is a silent no-op (no error, no stamp)", async () => {
  const app = makeApp();
  const server = await start(app);
  try {
    const biz = await seedBusiness("Unknown Id Co");
    const { send } = await seedNewsletterSend({
      businessId: biz.id,
      messageId: "re_real_id",
    });

    const res = await postSigned(server.url, {
      type: "email.opened",
      data: { email_id: "re_does_not_exist" },
    });
    assert.equal(res.status, 200);
    assert.equal(((await res.json()) as any).stamped, 0);

    const [unchanged] = await pgDb
      .select()
      .from(newsletterSends)
      .where(eq(newsletterSends.id, send.id));
    assert.equal(unchanged.openedAt, null);
    assert.equal(unchanged.clickedAt, null);
  } finally {
    await server.close();
  }
});

test("engagement event without an email_id is acknowledged but ignored", async () => {
  const app = makeApp();
  const server = await start(app);
  try {
    const res = await postSigned(server.url, {
      type: "email.opened",
      data: { to: ["x@example.com"] },
    });
    assert.equal(res.status, 200);
    const body = (await res.json()) as any;
    assert.equal(body.ignored, "no email_id");
  } finally {
    await server.close();
  }
});

test("complaint event is always treated as permanent", async () => {
  const app = makeApp();
  const server = await start(app);
  try {
    const biz = await seedBusiness("Complaint Co");
    const req = await seedSentRequest({
      businessId: biz.id,
      email: "angry@example.com",
    });

    const body = {
      type: "email.complained",
      data: {
        email_id: "re_yyy",
        to: ["angry@example.com"],
      },
    };
    const payload = JSON.stringify(body);
    const headers = signPayload(process.env.RESEND_WEBHOOK_SECRET!, payload);
    const res = await fetch(`${server.url}/api/webhooks/resend`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: payload,
    });
    assert.equal(res.status, 200);

    const [updated] = await pgDb
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.id, req.id));
    assert.equal(updated.status, "failed");
    assert.ok(updated.errorMsg?.startsWith("email[permanent]:"));

    const supps = await pgDb
      .select()
      .from(recipientSuppressions)
      .where(eq(recipientSuppressions.businessId, biz.id));
    assert.equal(supps.length, 1);
    assert.match(supps[0].reason, /complained/i);
  } finally {
    await server.close();
  }
});
