// Tests for the Marketing Hub aggregation endpoint:
//   GET /api/businesses/:id/marketing-hub?days=30
//
// Verifies:
//   1. Auth + Gold gating (401 unauth, 403 GOLD_REQUIRED for basic).
//   2. Aggregation across newsletter, sms, review_requests, deals,
//      social_drafts, and recipient_suppressions returns the expected
//      counts, scoped to the requested window.
//   3. Window scoping: rows older than `days` do not show up in
//      "in-window" tallies, but point-in-time tallies (subscribers,
//      suppressions, currently-active deals) are not range-filtered.

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
  smsCampaigns,
  smsSubscribers,
  reviewRequests,
  deals,
  socialDrafts,
  recipientSuppressions,
} from "@shared/schema";
import { users } from "@shared/models/auth";
import { registerMarketingHubRoutes } from "../marketingHub";

const TEST_TAG = "__marketing_hub_test__";
let createdBizIds: number[] = [];
let createdUserIds: string[] = [];

async function seedBusiness(opts: { tier?: string } = {}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: `MH Test ${Date.now()}_${Math.random()}`,
      description: TEST_TAG,
      address: "1 Hub Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `mh_${Date.now()}_${Math.random()}@example.com`,
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
      email: `mhu_${Date.now()}_${Math.random()}@example.com`,
      firstName: "MH",
      lastName: "Tester",
      linkedBusinessId,
    })
    .returning();
  createdUserIds.push(row.id);
  return row;
}

async function cleanup() {
  if (createdBizIds.length) {
    await pgDb.delete(reviewRequests).where(inArray(reviewRequests.businessId, createdBizIds));
    await pgDb.delete(newsletterCampaigns).where(inArray(newsletterCampaigns.businessId, createdBizIds));
    await pgDb.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.businessId, createdBizIds));
    await pgDb.delete(smsCampaigns).where(inArray(smsCampaigns.businessId, createdBizIds));
    await pgDb.delete(smsSubscribers).where(inArray(smsSubscribers.businessId, createdBizIds));
    await pgDb.delete(deals).where(inArray(deals.businessId, createdBizIds));
    await pgDb.delete(socialDrafts).where(inArray(socialDrafts.businessId, createdBizIds));
    await pgDb.delete(recipientSuppressions).where(inArray(recipientSuppressions.businessId, createdBizIds));
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
    await pgDb.delete(reviewRequests).where(inArray(reviewRequests.businessId, ids));
    await pgDb.delete(newsletterCampaigns).where(inArray(newsletterCampaigns.businessId, ids));
    await pgDb.delete(newsletterSubscribers).where(inArray(newsletterSubscribers.businessId, ids));
    await pgDb.delete(smsCampaigns).where(inArray(smsCampaigns.businessId, ids));
    await pgDb.delete(smsSubscribers).where(inArray(smsSubscribers.businessId, ids));
    await pgDb.delete(deals).where(inArray(deals.businessId, ids));
    await pgDb.delete(socialDrafts).where(inArray(socialDrafts.businessId, ids));
    await pgDb.delete(recipientSuppressions).where(inArray(recipientSuppressions.businessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(cleanup);
after(cleanup);

function makeApp(userId: string | null) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    (req as any).isAuthenticated = () => !!userId;
    if (userId) (req as any).user = { id: userId };
    next();
  });
  registerMarketingHubRoutes(app);
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

test("marketing-hub: 401 when no session is attached", async () => {
  const biz = await seedBusiness({ tier: "premium" });
  const srv = await start(makeApp(null));
  try {
    const r = await fetch(`${srv.url}/api/businesses/${biz.id}/marketing-hub`);
    assert.equal(r.status, 401);
  } finally {
    await srv.close();
  }
});

test("marketing-hub: 403 GOLD_REQUIRED when caller is the owner but biz isn't Gold", async () => {
  const biz = await seedBusiness({ tier: "basic" });
  const owner = await seedUser(biz.id);
  const srv = await start(makeApp(owner.id));
  try {
    const r = await fetch(`${srv.url}/api/businesses/${biz.id}/marketing-hub`);
    assert.equal(r.status, 403);
    const body = await r.json();
    assert.equal(body.code, "GOLD_REQUIRED");
  } finally {
    await srv.close();
  }
});

test("marketing-hub: 403 when caller doesn't own the business", async () => {
  const biz = await seedBusiness({ tier: "premium" });
  const stranger = await seedUser(null);
  const srv = await start(makeApp(stranger.id));
  try {
    const r = await fetch(`${srv.url}/api/businesses/${biz.id}/marketing-hub`);
    assert.equal(r.status, 403);
  } finally {
    await srv.close();
  }
});

test("marketing-hub: aggregates per-suite counts, scoped by ?days window", async () => {
  const biz = await seedBusiness({ tier: "premium" });
  const owner = await seedUser(biz.id);
  const now = Date.now();
  const inWindow = new Date(now - 5 * 24 * 60 * 60 * 1000); // 5 days ago
  const outsideWindow = new Date(now - 60 * 24 * 60 * 60 * 1000); // 60 days ago

  // Newsletter: one in-window sent campaign, one OUT-of-window sent
  await pgDb.insert(newsletterCampaigns).values([
    {
      businessId: biz.id,
      subject: "In window",
      bodyHtml: "<p>x</p>",
      status: "sent",
      recipientCount: 100,
      successCount: 95,
      failureCount: 5,
      sentAt: inWindow,
    },
    {
      businessId: biz.id,
      subject: "Old",
      bodyHtml: "<p>old</p>",
      status: "sent",
      recipientCount: 999,
      successCount: 999,
      failureCount: 0,
      sentAt: outsideWindow,
    },
  ]);
  // Two subscribers, one unsubscribed (point-in-time, not range-scoped)
  await pgDb.insert(newsletterSubscribers).values([
    {
      businessId: biz.id,
      email: "a@example.com",
      unsubscribeToken: `tok_a_${now}`,
    },
    {
      businessId: biz.id,
      email: "b@example.com",
      unsubscribeToken: `tok_b_${now}`,
      unsubscribedAt: new Date(),
    },
  ]);

  // SMS: one in-window sent campaign
  await pgDb.insert(smsCampaigns).values({
    businessId: biz.id,
    body: "hi",
    status: "sent",
    recipientCount: 50,
    successCount: 48,
    failureCount: 2,
    creditsCharged: 96,
    sentAt: inWindow,
  });
  await pgDb.insert(smsSubscribers).values([
    { businessId: biz.id, phone: "+15555550101" },
    { businessId: biz.id, phone: "+15555550102", optedOutAt: new Date() },
  ]);

  // Review requests: one in-window with click + completion, one failed.
  // Stagger sentAt because (business_id, sent_at) is UNIQUE.
  const rrSentAt1 = new Date(now - 5 * 24 * 60 * 60 * 1000);
  const rrSentAt2 = new Date(now - 4 * 24 * 60 * 60 * 1000);
  await pgDb.insert(reviewRequests).values([
    {
      businessId: biz.id,
      recipientEmail: "c1@example.com",
      channel: "email",
      status: "completed",
      token: `mhtok1_${now}`,
      sentAt: rrSentAt1,
      clickedAt: rrSentAt1,
      completedReviewId: 999, // sentinel; FK isn't enforced for this column
    },
    {
      businessId: biz.id,
      recipientEmail: "c2@example.com",
      channel: "email",
      status: "failed",
      token: `mhtok2_${now}`,
      sentAt: rrSentAt2,
      errorMsg: "boom",
    },
  ]);

  // Deals: one currently active, one created out-of-window
  await pgDb.insert(deals).values([
    {
      businessId: biz.id,
      title: "Live deal",
      description: "d",
      discountText: "10% off",
      redemptionInstructions: "show this",
      startsAt: new Date(now - 60_000),
      endsAt: new Date(now + 24 * 60 * 60 * 1000),
      status: "active",
      clickCount: 7,
      createdAt: inWindow,
    },
    {
      businessId: biz.id,
      title: "Old deal",
      description: "d",
      discountText: "$5",
      redemptionInstructions: "x",
      startsAt: outsideWindow,
      endsAt: new Date(now - 24 * 60 * 60 * 1000), // already ended
      status: "archived",
      clickCount: 99,
      createdAt: outsideWindow,
    },
  ]);

  // Social drafts: one in-window draft + one posted
  await pgDb.insert(socialDrafts).values([
    {
      businessId: biz.id,
      sourceNotes: "notes 1",
      status: "draft",
      createdAt: inWindow,
    },
    {
      businessId: biz.id,
      sourceNotes: "notes 2",
      status: "posted",
      createdAt: inWindow,
    },
  ]);

  // Suppressions: 2 emails, 1 phone (point-in-time)
  await pgDb.insert(recipientSuppressions).values([
    { businessId: biz.id, contactType: "email", contact: "x1@example.com", reason: "bounce" },
    { businessId: biz.id, contactType: "email", contact: "x2@example.com", reason: "bounce" },
    { businessId: biz.id, contactType: "phone", contact: "+15555550199", reason: "stop" },
  ]);

  const srv = await start(makeApp(owner.id));
  try {
    const r = await fetch(`${srv.url}/api/businesses/${biz.id}/marketing-hub?days=30`);
    assert.equal(r.status, 200);
    const body = await r.json();

    assert.equal(body.rangeDays, 30);

    // Newsletter: only the in-window campaign counted
    assert.equal(body.newsletter.campaigns, 1);
    assert.equal(body.newsletter.recipients, 100);
    assert.equal(body.newsletter.delivered, 95);
    assert.equal(body.newsletter.failed, 5);
    assert.equal(body.newsletter.deliveryRate, 95);
    assert.equal(body.newsletter.subscribersTotal, 2);
    assert.equal(body.newsletter.subscribersActive, 1);

    // SMS
    assert.equal(body.sms.campaigns, 1);
    assert.equal(body.sms.delivered, 48);
    assert.equal(body.sms.creditsSpent, 96);
    assert.equal(body.sms.subscribersActive, 1);

    // Review Requests
    assert.equal(body.reviewRequests.sent, 2);
    assert.equal(body.reviewRequests.clicked, 1);
    assert.equal(body.reviewRequests.completed, 1);
    assert.equal(body.reviewRequests.failed, 1);
    assert.equal(body.reviewRequests.clickRate, 50);
    assert.equal(body.reviewRequests.completionRate, 50);

    // Deals: only one is currently active (the live one); old one is
    // archived and ended in the past.
    assert.equal(body.deals.currentlyActive, 1);
    assert.equal(body.deals.createdInWindow, 1);
    assert.equal(body.deals.clicksInWindow, 7);

    // Social
    assert.equal(body.social.drafts, 2);
    assert.equal(body.social.posted, 1);

    // Suppressions (point-in-time)
    assert.equal(body.suppressions.email, 2);
    assert.equal(body.suppressions.phone, 1);

    // Headline: 95 newsletter delivered + 48 sms delivered + 2 review reqs sent
    assert.equal(body.totalReach, 145);
  } finally {
    await srv.close();
  }
});

test("marketing-hub: ?days=7 includes a 5-day-old SMS, and an invalid ?days value falls back to 30", async () => {
  // Sanity check that the window value flows through. Re-using the same
  // shape as the 30-day test but with a tighter window — the 5-day-old
  // SMS campaign should drop out.
  const biz = await seedBusiness({ tier: "premium" });
  const owner = await seedUser(biz.id);
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  await pgDb.insert(smsCampaigns).values({
    businessId: biz.id,
    body: "hi",
    status: "sent",
    recipientCount: 10,
    successCount: 10,
    failureCount: 0,
    creditsCharged: 20,
    sentAt: fiveDaysAgo,
  });

  const srv = await start(makeApp(owner.id));
  try {
    const r7 = await fetch(`${srv.url}/api/businesses/${biz.id}/marketing-hub?days=7`);
    const body7 = await r7.json();
    assert.equal(body7.sms.campaigns, 1, "5-day-old SMS shows in 7-day window");

    // days=1 is invalid (not in [7, 30, 90]) → server defaults to 30
    const rBad = await fetch(`${srv.url}/api/businesses/${biz.id}/marketing-hub?days=1`);
    const bodyBad = await rBad.json();
    assert.equal(bodyBad.rangeDays, 30, "invalid days falls back to 30");
  } finally {
    await srv.close();
  }
});

// ── Hardening tests added after architect review ─────────────────────

test("marketing-hub: admin (not the owner) can read another business's hub", async () => {
  // The endpoint allows accountType==='admin' to bypass the owner check.
  // This test guards against accidentally tightening that to owner-only,
  // which would break the admin support flow.
  const biz = await seedBusiness({ tier: "premium" });
  const [admin] = await pgDb
    .insert(users)
    .values({
      email: `mh_admin_${Date.now()}_${Math.random()}@example.com`,
      firstName: "Admin",
      lastName: "User",
      accountType: "admin",
      linkedBusinessId: null, // explicitly NOT the owner
    })
    .returning();
  createdUserIds.push(admin.id);

  const srv = await start(makeApp(admin.id));
  try {
    const r = await fetch(`${srv.url}/api/businesses/${biz.id}/marketing-hub?days=30`);
    assert.equal(r.status, 200, "admin should get 200, not 403");
    const body = await r.json();
    assert.equal(body.rangeDays, 30);
  } finally {
    await srv.close();
  }
});

test("marketing-hub: comp-active business is treated as Gold (no Stripe tier required)", async () => {
  // isCompActive(b) → true should let the owner through even when
  // membershipTier='basic'. An expired comp must NOT count.
  const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const past = new Date(Date.now() - 24 * 60 * 60 * 1000);

  const [activeCompBiz] = await pgDb
    .insert(businesses)
    .values({
      name: `MH Comp Active ${Date.now()}_${Math.random()}`,
      description: TEST_TAG,
      address: "2 Comp Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `mh_comp_${Date.now()}_${Math.random()}@example.com`,
      membershipTier: "basic",
      isCompedMembership: true,
      compedMembershipExpiresAt: future,
    })
    .returning();
  createdBizIds.push(activeCompBiz.id);

  const [expiredCompBiz] = await pgDb
    .insert(businesses)
    .values({
      name: `MH Comp Expired ${Date.now()}_${Math.random()}`,
      description: TEST_TAG,
      address: "3 Comp Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `mh_comp_exp_${Date.now()}_${Math.random()}@example.com`,
      membershipTier: "basic",
      isCompedMembership: true,
      compedMembershipExpiresAt: past,
    })
    .returning();
  createdBizIds.push(expiredCompBiz.id);

  const ownerActive = await seedUser(activeCompBiz.id);
  const ownerExpired = await seedUser(expiredCompBiz.id);

  const srvA = await start(makeApp(ownerActive.id));
  try {
    const r = await fetch(`${srvA.url}/api/businesses/${activeCompBiz.id}/marketing-hub`);
    assert.equal(r.status, 200, "active comp owner should get 200");
  } finally {
    await srvA.close();
  }

  const srvE = await start(makeApp(ownerExpired.id));
  try {
    const r = await fetch(`${srvE.url}/api/businesses/${expiredCompBiz.id}/marketing-hub`);
    assert.equal(r.status, 403, "expired comp must NOT count as Gold");
    const body = await r.json();
    assert.equal(body.code, "GOLD_REQUIRED");
  } finally {
    await srvE.close();
  }
});

test("marketing-hub: cross-business isolation — biz A's hub never leaks biz B's activity", async () => {
  // A common regression class for aggregation endpoints is forgetting a
  // WHERE businessId=… clause on one of the sub-queries. Seed identical
  // activity for two businesses, request biz A, and assert each metric
  // counts only A's rows.
  const bizA = await seedBusiness({ tier: "premium" });
  const bizB = await seedBusiness({ tier: "premium" });
  const ownerA = await seedUser(bizA.id);
  const inWindow = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);

  for (const biz of [bizA, bizB]) {
    await pgDb.insert(newsletterCampaigns).values({
      businessId: biz.id,
      subject: `Hi from ${biz.id}`,
      bodyHtml: "<p>x</p>",
      status: "sent",
      recipientCount: 10,
      successCount: 10,
      failureCount: 0,
      sentAt: inWindow,
    });
    await pgDb.insert(newsletterSubscribers).values({
      businessId: biz.id,
      email: `sub_${biz.id}@example.com`,
      unsubscribeToken: `iso_${biz.id}_${Date.now()}_${Math.random()}`,
    });
    await pgDb.insert(smsCampaigns).values({
      businessId: biz.id,
      body: "hi",
      status: "sent",
      recipientCount: 5,
      successCount: 5,
      failureCount: 0,
      creditsCharged: 10,
      sentAt: inWindow,
    });
    await pgDb.insert(reviewRequests).values({
      businessId: biz.id,
      recipientEmail: `r_${biz.id}@example.com`,
      channel: "email",
      status: "sent",
      token: `iso_rr_${biz.id}_${Date.now()}_${Math.random().toString(36).slice(2)}`,
      sentAt: inWindow,
    });
    await pgDb.insert(deals).values({
      businessId: biz.id,
      title: `Deal ${biz.id}`,
      description: "d",
      discountText: "10%",
      redemptionInstructions: "show this",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      status: "active",
      clickCount: 3,
      createdAt: inWindow,
    });
    await pgDb.insert(socialDrafts).values({
      businessId: biz.id,
      sourceNotes: `notes ${biz.id}`,
      status: "draft",
      createdAt: inWindow,
    });
    await pgDb.insert(recipientSuppressions).values({
      businessId: biz.id,
      contactType: "email",
      contact: `supp_${biz.id}@example.com`,
      reason: "bounce",
    });
  }

  const srv = await start(makeApp(ownerA.id));
  try {
    const r = await fetch(`${srv.url}/api/businesses/${bizA.id}/marketing-hub?days=30`);
    assert.equal(r.status, 200);
    const body = await r.json();
    assert.equal(body.newsletter.campaigns, 1, "newsletter is biz-scoped");
    assert.equal(body.newsletter.delivered, 10);
    assert.equal(body.newsletter.subscribersTotal, 1);
    assert.equal(body.sms.campaigns, 1, "sms is biz-scoped");
    assert.equal(body.reviewRequests.sent, 1, "review reqs are biz-scoped");
    assert.equal(body.deals.currentlyActive, 1, "deals.currentlyActive is biz-scoped");
    assert.equal(body.deals.createdInWindow, 1);
    assert.equal(body.deals.clicksInWindow, 3);
    assert.equal(body.social.drafts, 1, "social is biz-scoped");
    assert.equal(body.suppressions.email, 1, "suppressions are biz-scoped");
    // headline: 10 nl delivered + 5 sms delivered + 1 rr sent = 16
    assert.equal(body.totalReach, 16);
  } finally {
    await srv.close();
  }
});

test("marketing-hub: window and active-deal boundaries are inclusive/exclusive as documented", async () => {
  // The endpoint uses `gte(sentAt, since)` for windowed metrics, so an
  // event timestamped exactly at `since` is INCLUDED. For active deals
  // it uses `startsAt <= now AND endsAt > now`, so:
  //   - a deal whose endsAt is exactly NOW is NOT currently active
  //   - a deal whose startsAt is exactly NOW IS currently active.
  const biz = await seedBusiness({ tier: "premium" });
  const owner = await seedUser(biz.id);

  // Compute the server's `since` for days=7. There's a tiny race between
  // when we compute "since" client-side here and when the server does;
  // pad by 5 seconds inside the window so we land on the inclusive side.
  const days = 7;
  const insideEdge = new Date(Date.now() - days * 24 * 60 * 60 * 1000 + 5_000);
  const outsideEdge = new Date(Date.now() - days * 24 * 60 * 60 * 1000 - 60_000);

  await pgDb.insert(newsletterCampaigns).values([
    {
      businessId: biz.id,
      subject: "edge-in",
      bodyHtml: "<p>x</p>",
      status: "sent",
      recipientCount: 1,
      successCount: 1,
      failureCount: 0,
      sentAt: insideEdge,
    },
    {
      businessId: biz.id,
      subject: "edge-out",
      bodyHtml: "<p>x</p>",
      status: "sent",
      recipientCount: 999,
      successCount: 999,
      failureCount: 0,
      sentAt: outsideEdge,
    },
  ]);

  // Two deals: one whose endsAt is in the past by 1ms (should NOT be
  // active); one whose endsAt is 1 hour in the future (should be).
  const justEnded = new Date(Date.now() - 1);
  const stillRunning = new Date(Date.now() + 60 * 60 * 1000);
  await pgDb.insert(deals).values([
    {
      businessId: biz.id,
      title: "just-ended",
      description: "d",
      discountText: "x",
      redemptionInstructions: "x",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: justEnded,
      status: "active",
      clickCount: 0,
      createdAt: insideEdge,
    },
    {
      businessId: biz.id,
      title: "still-running",
      description: "d",
      discountText: "x",
      redemptionInstructions: "x",
      startsAt: new Date(Date.now() - 60_000),
      endsAt: stillRunning,
      status: "active",
      clickCount: 0,
      createdAt: insideEdge,
    },
  ]);

  const srv = await start(makeApp(owner.id));
  try {
    const r = await fetch(`${srv.url}/api/businesses/${biz.id}/marketing-hub?days=7`);
    const body = await r.json();
    assert.equal(body.newsletter.campaigns, 1, "out-of-window campaign must not count");
    assert.equal(body.newsletter.delivered, 1);
    assert.equal(body.deals.currentlyActive, 1, "deal whose endsAt just passed must NOT count as active");
  } finally {
    await srv.close();
  }
});
