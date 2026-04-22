// Tests for the additional-zip cancellation flow:
//   1. cancelAdditionalZipForOwner — the function the
//      POST /api/businesses/:id/cancel-additional-zip route delegates to.
//      Verifies the listing is archived, Stripe.subscriptions.cancel is
//      invoked, and the owner's active listing is re-pointed off the now
//      archived row.
//   2. handleAdditionalZipSubscriptionDeleted — the webhook hook fired on
//      customer.subscription.deleted. Verifies it ONLY archives rows where
//      isAdditionalZip = true (membership cancellations are handled
//      elsewhere) and re-points the user's active listing.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";

import { db as pgDb } from "../db";
import { businesses, users } from "@shared/schema";
import {
  cancelAdditionalZipForOwner,
  handleAdditionalZipSubscriptionDeleted,
  __setStripeForTesting,
} from "../multiZip";

const TEST_TAG = "__addzip_cancel_test__";

let createdBusinessIds: number[] = [];
let createdUserIds: string[] = [];

async function seedBusiness(opts: {
  name: string;
  ownerUserId?: string | null;
  parentBusinessId?: number | null;
  isAdditionalZip?: boolean;
  stripeSubscriptionId?: string | null;
  zipCode?: string;
  status?: string;
}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: opts.name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `${opts.name.replace(/\s+/g, "").toLowerCase()}-${Math.random()
        .toString(36)
        .slice(2, 7)}@example.com`,
      city: "Moyock",
      state: "NC",
      zipCode: opts.zipCode ?? "27958",
      membershipTier: "premium",
      stripeCustomerId: "cus_test_" + Math.random().toString(36).slice(2, 8),
      stripeSubscriptionId: opts.stripeSubscriptionId ?? null,
      ownerUserId: opts.ownerUserId ?? null,
      parentBusinessId: opts.parentBusinessId ?? null,
      isAdditionalZip: opts.isAdditionalZip ?? false,
      status: opts.status ?? "active",
      referralCode: `ADDZIPCAN-${Math.random().toString(36).slice(2, 10)}`,
      foundingMemberNumber: null,
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function seedUser(opts: { linkedBusinessId?: number | null }) {
  const id = "user-addzip-cancel-" + Math.random().toString(36).slice(2, 10);
  await pgDb.insert(users).values({
    id,
    email: `${id}@example.com`,
    accountType: "business",
    linkedBusinessId: opts.linkedBusinessId ?? null,
  });
  createdUserIds.push(id);
  return id;
}

async function cleanup() {
  if (createdUserIds.length) {
    await pgDb.delete(users).where(inArray(users.id, createdUserIds));
    createdUserIds = [];
  }
  if (createdBusinessIds.length) {
    const children = await pgDb
      .select({ id: businesses.id })
      .from(businesses)
      .where(inArray(businesses.parentBusinessId, createdBusinessIds));
    const all = Array.from(new Set([...createdBusinessIds, ...children.map((c) => c.id)]));
    await pgDb.delete(businesses).where(inArray(businesses.id, all));
    createdBusinessIds = [];
  }
}

before(async () => {
  // Clean up stragglers from any previously-failed test run.
  const stragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (stragglers.length) {
    const ids = stragglers.map((s) => s.id);
    const children = await pgDb
      .select({ id: businesses.id })
      .from(businesses)
      .where(inArray(businesses.parentBusinessId, ids));
    const all = Array.from(new Set([...ids, ...children.map((c) => c.id)]));
    await pgDb.delete(businesses).where(inArray(businesses.id, all));
  }
});

beforeEach(async () => {
  await cleanup();
  __setStripeForTesting(null);
});

after(async () => {
  await cleanup();
  __setStripeForTesting(null);
});

interface StripeStub {
  client: Stripe;
  cancelCalls: string[];
  shouldThrow: boolean;
}

function makeStripeStub(): StripeStub {
  const stub: StripeStub = {
    client: undefined as unknown as Stripe,
    cancelCalls: [],
    shouldThrow: false,
  };
  stub.client = {
    subscriptions: {
      cancel: async (subId: string) => {
        stub.cancelCalls.push(subId);
        if (stub.shouldThrow) throw new Error("stripe boom");
        return { id: subId, status: "canceled" };
      },
    },
  } as unknown as Stripe;
  return stub;
}

// ---------------------------------------------------------------------------
// cancelAdditionalZipForOwner (route handler logic)
// ---------------------------------------------------------------------------

test("cancel-additional-zip: archives the child, cancels the Stripe sub, and re-points the user's active listing", async () => {
  const parent = await seedBusiness({ name: "Cancel Parent Happy" });
  const userId = await seedUser({ linkedBusinessId: parent.id });
  // Adopt the parent under this user so loadOwnedBusiness recognizes it.
  await pgDb.update(businesses).set({ ownerUserId: userId }).where(eq(businesses.id, parent.id));

  const child = await seedBusiness({
    name: "Cancel Child Happy",
    ownerUserId: userId,
    parentBusinessId: parent.id,
    isAdditionalZip: true,
    stripeSubscriptionId: "sub_addzip_cancel_happy",
    zipCode: "27950",
  });

  // Pretend the user is currently viewing the child listing.
  await pgDb.update(users).set({ linkedBusinessId: child.id }).where(eq(users.id, userId));

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  const result = await cancelAdditionalZipForOwner(userId, child.id);

  assert.equal(result.status, 200);
  assert.deepEqual(result.body, { ok: true });
  assert.deepEqual(stub.cancelCalls, ["sub_addzip_cancel_happy"], "Stripe.subscriptions.cancel called once with the child's sub id");

  const [reloadedChild] = await pgDb.select().from(businesses).where(eq(businesses.id, child.id));
  assert.equal(reloadedChild.status, "archived", "child listing must be archived");

  const [reloadedUser] = await pgDb.select().from(users).where(eq(users.id, userId));
  assert.equal(
    reloadedUser.linkedBusinessId,
    parent.id,
    "user should be re-pointed to a remaining active listing (the parent)",
  );

  // Parent must remain untouched.
  const [reloadedParent] = await pgDb.select().from(businesses).where(eq(businesses.id, parent.id));
  assert.equal(reloadedParent.status, "active", "parent listing must NOT be archived");
});

test("cancel-additional-zip: 403 when the caller does not own the listing", async () => {
  const parent = await seedBusiness({ name: "Cancel Parent NotOwner" });
  const otherOwnerId = await seedUser({ linkedBusinessId: null });
  const child = await seedBusiness({
    name: "Cancel Child NotOwner",
    ownerUserId: otherOwnerId,
    parentBusinessId: parent.id,
    isAdditionalZip: true,
    stripeSubscriptionId: "sub_addzip_cancel_notowner",
  });
  const intruder = await seedUser({ linkedBusinessId: null });

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  const result = await cancelAdditionalZipForOwner(intruder, child.id);

  assert.equal(result.status, 403);
  assert.deepEqual(stub.cancelCalls, [], "Stripe must NOT be called when ownership check fails");

  const [stillThere] = await pgDb.select().from(businesses).where(eq(businesses.id, child.id));
  assert.equal(stillThere.status, "active", "listing must remain active when the wrong user tries to cancel");
});

test("cancel-additional-zip: 400 when the target listing is the primary (not an additional zip)", async () => {
  const userId = await seedUser({ linkedBusinessId: null });
  const primary = await seedBusiness({
    name: "Cancel Primary Refused",
    ownerUserId: userId,
    isAdditionalZip: false,
    stripeSubscriptionId: "sub_primary_refused",
  });
  await pgDb.update(users).set({ linkedBusinessId: primary.id }).where(eq(users.id, userId));

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  const result = await cancelAdditionalZipForOwner(userId, primary.id);

  assert.equal(result.status, 400);
  assert.match(String(result.body.message), /billing portal/i);
  assert.deepEqual(stub.cancelCalls, [], "Stripe must NOT be called for primary listings");

  const [reloaded] = await pgDb.select().from(businesses).where(eq(businesses.id, primary.id));
  assert.equal(reloaded.status, "active", "primary listing must NOT be archived via this route");
});

test("cancel-additional-zip: still archives the listing when the Stripe cancel call throws", async () => {
  const parent = await seedBusiness({ name: "Cancel Parent StripeFail" });
  const userId = await seedUser({ linkedBusinessId: null });
  await pgDb.update(businesses).set({ ownerUserId: userId }).where(eq(businesses.id, parent.id));
  const child = await seedBusiness({
    name: "Cancel Child StripeFail",
    ownerUserId: userId,
    parentBusinessId: parent.id,
    isAdditionalZip: true,
    stripeSubscriptionId: "sub_addzip_stripefail",
  });

  const stub = makeStripeStub();
  stub.shouldThrow = true;
  __setStripeForTesting(stub.client);

  const result = await cancelAdditionalZipForOwner(userId, child.id);

  assert.equal(result.status, 200, "DB archive must still succeed even if Stripe blows up");
  assert.deepEqual(stub.cancelCalls, ["sub_addzip_stripefail"]);

  const [reloaded] = await pgDb.select().from(businesses).where(eq(businesses.id, child.id));
  assert.equal(reloaded.status, "archived");
});

test("cancel-additional-zip: leaves linkedBusinessId untouched when the user wasn't viewing the cancelled listing", async () => {
  const parent = await seedBusiness({ name: "Cancel Parent NoSwitch" });
  const userId = await seedUser({ linkedBusinessId: parent.id });
  await pgDb.update(businesses).set({ ownerUserId: userId }).where(eq(businesses.id, parent.id));
  const child = await seedBusiness({
    name: "Cancel Child NoSwitch",
    ownerUserId: userId,
    parentBusinessId: parent.id,
    isAdditionalZip: true,
    stripeSubscriptionId: "sub_addzip_noswitch",
  });

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  await cancelAdditionalZipForOwner(userId, child.id);

  const [reloadedUser] = await pgDb.select().from(users).where(eq(users.id, userId));
  assert.equal(
    reloadedUser.linkedBusinessId,
    parent.id,
    "user's active listing should not change when they weren't viewing the child",
  );
});

// ---------------------------------------------------------------------------
// handleAdditionalZipSubscriptionDeleted (webhook hook)
// ---------------------------------------------------------------------------

function makeSubDeleted(subId: string): Stripe.Subscription {
  return { id: subId } as unknown as Stripe.Subscription;
}

test("subscription.deleted: archives the matching additional-zip listing and re-points the active listing", async () => {
  const parent = await seedBusiness({ name: "WebhookCancel Parent" });
  const userId = await seedUser({ linkedBusinessId: null });
  await pgDb.update(businesses).set({ ownerUserId: userId }).where(eq(businesses.id, parent.id));
  const child = await seedBusiness({
    name: "WebhookCancel Child",
    ownerUserId: userId,
    parentBusinessId: parent.id,
    isAdditionalZip: true,
    stripeSubscriptionId: "sub_webhook_cancel_happy",
  });
  await pgDb.update(users).set({ linkedBusinessId: child.id }).where(eq(users.id, userId));

  await handleAdditionalZipSubscriptionDeleted(makeSubDeleted("sub_webhook_cancel_happy"));

  const [reloadedChild] = await pgDb.select().from(businesses).where(eq(businesses.id, child.id));
  assert.equal(reloadedChild.status, "archived");

  const [reloadedUser] = await pgDb.select().from(users).where(eq(users.id, userId));
  assert.equal(reloadedUser.linkedBusinessId, parent.id, "user is moved off the archived child onto a remaining active listing");
});

test("subscription.deleted: refuses to touch a primary listing even if the sub id matches (membership flow handles it)", async () => {
  const userId = await seedUser({ linkedBusinessId: null });
  const primary = await seedBusiness({
    name: "WebhookCancel Primary",
    ownerUserId: userId,
    isAdditionalZip: false, // <- the critical bit
    stripeSubscriptionId: "sub_membership_primary",
  });
  await pgDb.update(users).set({ linkedBusinessId: primary.id }).where(eq(users.id, userId));

  await handleAdditionalZipSubscriptionDeleted(makeSubDeleted("sub_membership_primary"));

  const [reloaded] = await pgDb.select().from(businesses).where(eq(businesses.id, primary.id));
  assert.equal(reloaded.status, "active", "primary listing must NOT be archived by the additional-zip handler");

  const [reloadedUser] = await pgDb.select().from(users).where(eq(users.id, userId));
  assert.equal(reloadedUser.linkedBusinessId, primary.id, "user's active listing must not be re-pointed");
});

test("subscription.deleted: no-op when no listing matches the sub id", async () => {
  // Just shouldn't throw.
  await handleAdditionalZipSubscriptionDeleted(makeSubDeleted("sub_does_not_exist_anywhere"));
});

test("subscription.deleted: leaves linkedBusinessId untouched when the user wasn't viewing the cancelled additional zip", async () => {
  const parent = await seedBusiness({ name: "WebhookCancel Parent NoSwitch" });
  const userId = await seedUser({ linkedBusinessId: parent.id });
  await pgDb.update(businesses).set({ ownerUserId: userId }).where(eq(businesses.id, parent.id));
  const child = await seedBusiness({
    name: "WebhookCancel Child NoSwitch",
    ownerUserId: userId,
    parentBusinessId: parent.id,
    isAdditionalZip: true,
    stripeSubscriptionId: "sub_webhook_cancel_noswitch",
  });

  await handleAdditionalZipSubscriptionDeleted(makeSubDeleted("sub_webhook_cancel_noswitch"));

  const [reloadedChild] = await pgDb.select().from(businesses).where(eq(businesses.id, child.id));
  assert.equal(reloadedChild.status, "archived");

  const [reloadedUser] = await pgDb.select().from(users).where(eq(users.id, userId));
  assert.equal(reloadedUser.linkedBusinessId, parent.id, "user's active listing must not change");
});
