// Tests for reconcileCompedSubscriptions — the self-healing sweep that
// finds ACTIVE comped businesses still holding a live paid membership
// subscription pointer and cancels it.
//
// What this protects:
//   1. A comp granted BEFORE the grant-time auto-cancel shipped (legacy
//      row) gets its paid subscription canceled by the sweep instead of
//      silently billing the customer every cycle (the Back Bay bug).
//   2. EXPIRED comps are skipped — those businesses are back on a real
//      paid tier, so their subscription is legitimate.
//   3. Non-membership subs (metadata.type set, e.g. additional_zip) are
//      never canceled and the pointer is kept.
//   4. A Stripe failure keeps the pointer so the next hourly run retries;
//      the sweep never orphans a possibly-still-billing sub.
//   5. Non-comped businesses are never touched.

process.env.RESEND_API_KEY = "";

import test, { beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";

import { db as pgDb } from "../db";
import { businesses } from "@shared/schema";
import { reconcileCompedSubscriptions, __setStripeForTesting } from "../comp";

// Stripe stub that only knows the sub ids this test seeded. Any OTHER sub
// id (e.g. pre-existing comped rows in the dev database) throws on
// retrieve, which routes those rows down the error path — the sweep leaves
// their pointers untouched, so running this test never mutates rows it
// didn't create.
function makeStripeStub(known: Record<string, { type?: string; status?: string }>, opts: { throwOnCancel?: boolean } = {}) {
  const cancelCalls: string[] = [];
  const client = {
    subscriptions: {
      retrieve: async (id: string) => {
        const k = known[id];
        if (!k) throw new Error(`unknown sub ${id}`);
        return { id, status: k.status ?? "active", metadata: k.type ? { type: k.type } : {} };
      },
      cancel: async (id: string) => {
        cancelCalls.push(id);
        if (opts.throwOnCancel) throw new Error("stripe boom");
        return { id, status: "canceled" };
      },
    },
  } as unknown as import("stripe").default;
  return { cancelCalls, client };
}

let createdBizIds: number[] = [];

async function seedBusiness(opts: {
  comped?: boolean;
  expiresAt?: Date | null;
  subId?: string | null;
}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: `Reconcile Test Biz ${Date.now()}_${Math.random()}`,
      description: "__reconcile_comp_test__",
      address: "1 Sweep St",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `reconcile_${Date.now()}@example.com`,
      city: "Moyock",
      state: "NC",
      zipCode: "27958",
      membershipTier: "premium",
      isCompedMembership: opts.comped ?? false,
      compedMembershipExpiresAt: opts.expiresAt ?? null,
      stripeSubscriptionId: opts.subId ?? null,
    })
    .returning();
  createdBizIds.push(row.id);
  return row;
}

async function getSubPointer(id: number): Promise<string | null> {
  const [row] = await pgDb
    .select({ sub: businesses.stripeSubscriptionId })
    .from(businesses)
    .where(eq(businesses.id, id));
  return row?.sub ?? null;
}

async function cleanup() {
  if (createdBizIds.length) {
    await pgDb.delete(businesses).where(inArray(businesses.id, createdBizIds));
    createdBizIds = [];
  }
}

beforeEach(async () => {
  await cleanup();
  __setStripeForTesting(null);
});

after(async () => {
  await cleanup();
  __setStripeForTesting(null);
});

test("cancels the live membership sub of an ACTIVE comped business and clears the pointer", async () => {
  const biz = await seedBusiness({ comped: true, expiresAt: null, subId: "sub_legacy_live" });
  const stub = makeStripeStub({ sub_legacy_live: {} });
  __setStripeForTesting(stub.client);

  await reconcileCompedSubscriptions();

  assert.ok(stub.cancelCalls.includes("sub_legacy_live"));
  assert.equal(await getSubPointer(biz.id), null);
});

test("also handles comps with a FUTURE expiry (still active)", async () => {
  const future = new Date(Date.now() + 30 * 86400000);
  const biz = await seedBusiness({ comped: true, expiresAt: future, subId: "sub_future_comp" });
  const stub = makeStripeStub({ sub_future_comp: {} });
  __setStripeForTesting(stub.client);

  await reconcileCompedSubscriptions();

  assert.ok(stub.cancelCalls.includes("sub_future_comp"));
  assert.equal(await getSubPointer(biz.id), null);
});

test("skips EXPIRED comps — their subscription is a legitimate paid membership", async () => {
  const past = new Date(Date.now() - 86400000);
  const biz = await seedBusiness({ comped: true, expiresAt: past, subId: "sub_expired_comp" });
  const stub = makeStripeStub({ sub_expired_comp: {} });
  __setStripeForTesting(stub.client);

  await reconcileCompedSubscriptions();

  assert.equal(stub.cancelCalls.includes("sub_expired_comp"), false);
  assert.equal(await getSubPointer(biz.id), "sub_expired_comp");
});

test("never cancels a non-membership sub (metadata.type set) and keeps the pointer", async () => {
  const biz = await seedBusiness({ comped: true, subId: "sub_zip_child" });
  const stub = makeStripeStub({ sub_zip_child: { type: "additional_zip" } });
  __setStripeForTesting(stub.client);

  await reconcileCompedSubscriptions();

  assert.equal(stub.cancelCalls.length, 0);
  assert.equal(await getSubPointer(biz.id), "sub_zip_child");
});

test("keeps the pointer when Stripe cancel fails so the next run retries", async () => {
  const biz = await seedBusiness({ comped: true, subId: "sub_flaky" });
  const stub = makeStripeStub({ sub_flaky: {} }, { throwOnCancel: true });
  __setStripeForTesting(stub.client);

  await reconcileCompedSubscriptions();

  assert.ok(stub.cancelCalls.includes("sub_flaky"));
  assert.equal(await getSubPointer(biz.id), "sub_flaky");
});

test("ignores non-comped businesses entirely", async () => {
  const biz = await seedBusiness({ comped: false, subId: "sub_paying_member" });
  const stub = makeStripeStub({ sub_paying_member: {} });
  __setStripeForTesting(stub.client);

  await reconcileCompedSubscriptions();

  assert.equal(stub.cancelCalls.includes("sub_paying_member"), false);
  assert.equal(await getSubPointer(biz.id), "sub_paying_member");
});

test("does nothing when Stripe is not configured", async () => {
  const biz = await seedBusiness({ comped: true, subId: "sub_no_stripe" });
  __setStripeForTesting(null);

  await reconcileCompedSubscriptions();

  assert.equal(await getSubPointer(biz.id), "sub_no_stripe");
});

test("already-canceled subs in Stripe just get the pointer cleared without a cancel call", async () => {
  const biz = await seedBusiness({ comped: true, subId: "sub_already_dead" });
  const stub = makeStripeStub({ sub_already_dead: { status: "canceled" } });
  __setStripeForTesting(stub.client);

  await reconcileCompedSubscriptions();

  assert.equal(stub.cancelCalls.length, 0);
  assert.equal(await getSubPointer(biz.id), null);
});
