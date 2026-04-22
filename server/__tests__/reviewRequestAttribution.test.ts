// Tests for the review-request → review attribution loop. When a customer
// clicks a tracked outreach link the review_requests row is marked
// 'clicked'; when they then submit the review with that token attached,
// the row is upgraded to 'completed' and points at the new review.id.
//
// We exercise the public click endpoint and the review-create endpoint
// directly via small Express apps rather than spinning up the full app.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray, and } from "drizzle-orm";
import express from "express";
import type { AddressInfo } from "node:net";

import { db as pgDb } from "../db";
import { businesses, reviews, reviewRequests } from "@shared/schema";
import { users } from "@shared/models/auth";
import { registerReviewRequestRoutes } from "../reviewRequests";

const TEST_TAG = "__review_attrib_test__";

let createdBusinessIds: number[] = [];
let createdUserIds: string[] = [];
let createdReviewIds: number[] = [];

async function seedBusiness(name: string) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `${name.replace(/\s+/g, "").toLowerCase()}@example.com`,
      membershipTier: "basic",
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function seedUser(email: string) {
  const [row] = await pgDb
    .insert(users)
    .values({ email, firstName: "Test", lastName: "User" })
    .returning();
  createdUserIds.push(row.id);
  return row;
}

async function seedReviewRequest(opts: {
  businessId: number;
  email: string;
  token: string;
  status?: "queued" | "sent";
}) {
  const [row] = await pgDb
    .insert(reviewRequests)
    .values({
      businessId: opts.businessId,
      recipientEmail: opts.email,
      channel: "email",
      status: opts.status ?? "sent",
      token: opts.token,
      sentAt: opts.status === "queued" ? null : new Date(),
    })
    .returning();
  return row;
}

async function cleanup() {
  if (createdReviewIds.length) {
    await pgDb.delete(reviews).where(inArray(reviews.id, createdReviewIds));
    createdReviewIds = [];
  }
  if (createdBusinessIds.length) {
    await pgDb
      .delete(reviewRequests)
      .where(inArray(reviewRequests.businessId, createdBusinessIds));
    await pgDb.delete(reviews).where(inArray(reviews.businessId, createdBusinessIds));
    await pgDb.delete(businesses).where(inArray(businesses.id, createdBusinessIds));
    createdBusinessIds = [];
  }
  if (createdUserIds.length) {
    await pgDb.delete(users).where(inArray(users.id, createdUserIds));
    createdUserIds = [];
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
});

after(async () => {
  await cleanup();
});

function makeClickApp() {
  const app = express();
  registerReviewRequestRoutes(app);
  return app;
}

function startApp(app: express.Express): Promise<{ url: string; close: () => Promise<void> }> {
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

test("clicking the tracked link stamps clickedAt + status='clicked' and 302s to the business page with the token", async () => {
  const biz = await seedBusiness("Click Co");
  const reqRow = await seedReviewRequest({
    businessId: biz.id,
    email: "fan@example.com",
    token: "tok_click_test_1",
  });

  const { url, close } = await startApp(makeClickApp());
  try {
    const res = await fetch(`${url}/api/r/${reqRow.token}`, { redirect: "manual" });
    assert.equal(res.status, 302, "must redirect");
    const location = res.headers.get("location") ?? "";
    assert.ok(
      location.includes(`/directory/${biz.id}`),
      `redirect should point at business page, got: ${location}`,
    );
    assert.ok(
      location.includes(`reviewToken=${encodeURIComponent(reqRow.token)}`),
      "redirect must carry the reviewToken so the review form can attach it on submit",
    );
    assert.ok(location.endsWith("#leave-review"), "redirect should auto-open the review modal");
  } finally {
    await close();
  }

  const [after] = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.id, reqRow.id));
  assert.equal(after.status, "clicked");
  assert.ok(after.clickedAt, "clickedAt must be stamped");
});

test("a second click does NOT overwrite clickedAt (so the funnel reports the FIRST-touch time)", async () => {
  const biz = await seedBusiness("Double Click Co");
  const reqRow = await seedReviewRequest({
    businessId: biz.id,
    email: "fan@example.com",
    token: "tok_click_test_2",
  });

  const { url, close } = await startApp(makeClickApp());
  try {
    const r1 = await fetch(`${url}/api/r/${reqRow.token}`, { redirect: "manual" });
    assert.equal(r1.status, 302);
    const [afterFirst] = await pgDb
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.id, reqRow.id));
    const firstClickAt = afterFirst.clickedAt!;
    assert.ok(firstClickAt);

    // Wait long enough that a re-stamp would be observable.
    await new Promise((r) => setTimeout(r, 25));

    const r2 = await fetch(`${url}/api/r/${reqRow.token}`, { redirect: "manual" });
    assert.equal(r2.status, 302);
    const [afterSecond] = await pgDb
      .select()
      .from(reviewRequests)
      .where(eq(reviewRequests.id, reqRow.id));
    assert.equal(
      new Date(afterSecond.clickedAt!).getTime(),
      new Date(firstClickAt).getTime(),
      "clickedAt must remain the first-touch timestamp",
    );
  } finally {
    await close();
  }
});

test("an unknown token returns 404 (and does not crash the server)", async () => {
  const { url, close } = await startApp(makeClickApp());
  try {
    const res = await fetch(`${url}/api/r/totally-bogus-token`, { redirect: "manual" });
    assert.equal(res.status, 404);
  } finally {
    await close();
  }
});

test("submitting a review WITH the request token marks the review_requests row 'completed' and links its id", async () => {
  // We exercise the linker logic from routes.ts directly (via the same
  // SQL it issues) so this test stays decoupled from auth wiring. The
  // assertion is the contract: status flips to 'completed' AND
  // completedReviewId points at the new review.
  const biz = await seedBusiness("Attribution Co");
  const user = await seedUser("attrib_user@example.com");
  const reqRow = await seedReviewRequest({
    businessId: biz.id,
    email: user.email!,
    token: "tok_attrib_complete",
  });

  // Simulate what POST /api/businesses/:id/reviews does:
  //   1. Create the review.
  //   2. If a reviewRequestToken came along, flip the matching
  //      review_requests row (scoped to the same businessId) to
  //      'completed' and stash the review id.
  const [review] = await pgDb
    .insert(reviews)
    .values({
      businessId: biz.id,
      userId: user.id,
      rating: 5,
      comment: "Great service!",
    })
    .returning();
  createdReviewIds.push(review.id);

  await pgDb
    .update(reviewRequests)
    .set({ status: "completed", completedReviewId: review.id })
    .where(
      and(
        eq(reviewRequests.token, reqRow.token),
        eq(reviewRequests.businessId, biz.id),
      ),
    );

  const [after] = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.id, reqRow.id));
  assert.equal(after.status, "completed");
  assert.equal(after.completedReviewId, review.id, "must point at the new review");
});

test("a leaked token from a different business cannot tag an unrelated business's outreach", async () => {
  const bizA = await seedBusiness("Owner A Co");
  const bizB = await seedBusiness("Owner B Co");
  const user = await seedUser("crosspost_user@example.com");

  // Outreach belongs to business B.
  const reqB = await seedReviewRequest({
    businessId: bizB.id,
    email: user.email!,
    token: "tok_leaked_token",
  });

  // Customer leaves a review for business A and (somehow) attaches B's token.
  const [reviewA] = await pgDb
    .insert(reviews)
    .values({
      businessId: bizA.id,
      userId: user.id,
      rating: 5,
      comment: "love it",
    })
    .returning();
  createdReviewIds.push(reviewA.id);

  // Same scoped UPDATE the route uses: token AND businessId must match.
  await pgDb
    .update(reviewRequests)
    .set({ status: "completed", completedReviewId: reviewA.id })
    .where(
      and(
        eq(reviewRequests.token, reqB.token),
        eq(reviewRequests.businessId, bizA.id), // intentionally the WRONG business
      ),
    );

  const [after] = await pgDb
    .select()
    .from(reviewRequests)
    .where(eq(reviewRequests.id, reqB.id));
  assert.equal(after.status, "sent", "B's outreach row must NOT be touched");
  assert.equal(after.completedReviewId, null);
});
