// Tests for handleAdditionalZipCheckoutCompleted — fires from the Stripe
// checkout.session.completed webhook when metadata.type === "additional_zip".
// Verifies that a new child business is created in the requested zip,
// inherits the parent's tier/customer, never gets a fresh Gold trial, and
// is fully idempotent if the same subscription is delivered twice.
//
// NOTE: handleAdditionalZipCheckoutCompleted does not currently send a
// receipt email itself — the dedicated receipt-email path is tracked in a
// separate task. These tests therefore stub no email module: there is
// nothing to stub, and importing the module loads only the DB layer.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray, or } from "drizzle-orm";
import type Stripe from "stripe";

import { db as pgDb } from "../db";
import { businesses } from "@shared/schema";
import { handleAdditionalZipCheckoutCompleted } from "../multiZip";

const TEST_TAG = "__addzip_checkout_test__";

let createdBusinessIds: number[] = [];

async function seedParent(opts: {
  name: string;
  membershipTier?: "basic" | "standard" | "premium";
  stripeCustomerId?: string;
}) {
  const [row] = await pgDb
    .insert(businesses)
    .values({
      name: opts.name,
      description: TEST_TAG,
      address: "1 Test Way",
      category: "Service",
      imageUrl: "https://example.com/x.png",
      email: `${opts.name.replace(/\s+/g, "").toLowerCase()}@example.com`,
      city: "Moyock",
      state: "NC",
      zipCode: "27958",
      membershipTier: opts.membershipTier ?? "premium",
      stripeCustomerId: opts.stripeCustomerId ?? "cus_parent_default",
      stripeSubscriptionId: "sub_parent_membership",
      goldTrialEndDate: new Date(Date.now() + 30 * 24 * 3600 * 1000),
      isFoundingMember: true,
      foundingMemberNumber: null, // avoid unique-int collision noise
      referralCode: `ADDZIP-${Math.random().toString(36).slice(2, 10)}`,
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function cleanup() {
  if (createdBusinessIds.length === 0) return;
  // Delete child listings first (fk-style cleanup).
  const children = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(inArray(businesses.parentBusinessId, createdBusinessIds));
  const childIds = children.map((c) => c.id);
  const all = Array.from(new Set([...createdBusinessIds, ...childIds]));
  await pgDb.delete(businesses).where(inArray(businesses.id, all));
  createdBusinessIds = [];
}

before(async () => {
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
});

after(async () => {
  await cleanup();
});

function makeSession(opts: {
  parentId: number;
  ownerUserId: string;
  zipCode: string;
  city?: string;
  state?: string;
  subscriptionId?: string | null;
  customerId?: string | null;
}): Stripe.Checkout.Session {
  return {
    id: "cs_test_" + Math.random().toString(36).slice(2, 10),
    metadata: {
      type: "additional_zip",
      parentBusinessId: String(opts.parentId),
      ownerUserId: opts.ownerUserId,
      zipCode: opts.zipCode,
      city: opts.city ?? "Outer Banks",
      state: opts.state ?? "NC",
    },
    subscription: opts.subscriptionId ?? null,
    customer: opts.customerId ?? null,
  } as unknown as Stripe.Checkout.Session;
}

test("happy path: creates a child listing in the new zip, inheriting the parent's tier and Stripe customer", async () => {
  const parent = await seedParent({ name: "Add Zip Parent Happy", membershipTier: "premium" });
  const ownerUserId = "user-addzip-happy-" + Date.now();
  const session = makeSession({
    parentId: parent.id,
    ownerUserId,
    zipCode: "27950",
    city: "Currituck",
    state: "NC",
    subscriptionId: "sub_addzip_happy",
    customerId: "cus_addzip_happy",
  });

  await handleAdditionalZipCheckoutCompleted(session);

  const children = await pgDb
    .select()
    .from(businesses)
    .where(eq(businesses.parentBusinessId, parent.id));
  assert.equal(children.length, 1, "exactly one child listing must be created");
  const child = children[0];
  createdBusinessIds.push(child.id);

  assert.equal(child.zipCode, "27950");
  assert.equal(child.city, "Currituck");
  assert.equal(child.state, "NC");
  assert.equal(child.ownerUserId, ownerUserId);
  assert.equal(child.isAdditionalZip, true, "must be flagged as additional zip");
  assert.equal(child.status, "active");
  assert.equal(child.parentBusinessId, parent.id);
  assert.equal(child.membershipTier, parent.membershipTier, "tier inherited from parent");
  assert.equal(child.stripeSubscriptionId, "sub_addzip_happy", "tracks its own sub, not the parent's");
  assert.equal(child.stripeCustomerId, "cus_addzip_happy");
  assert.equal(child.goldTrialEndDate, null, "additional-zip listings NEVER get a fresh Gold trial");
  assert.equal(child.isFoundingMember, false, "founding-member status is not inherited");
  assert.equal(child.foundingMemberNumber, null);
  assert.equal(child.referralCode, null, "child listings do not get their own referral code");
});

test("idempotent: replaying the same checkout.session.completed for the same subscription does not create a duplicate listing", async () => {
  const parent = await seedParent({ name: "Add Zip Parent Idem", membershipTier: "standard" });
  const ownerUserId = "user-addzip-idem-" + Date.now();
  const session = makeSession({
    parentId: parent.id,
    ownerUserId,
    zipCode: "27949",
    subscriptionId: "sub_addzip_idem",
    customerId: "cus_addzip_idem",
  });

  await handleAdditionalZipCheckoutCompleted(session);
  await handleAdditionalZipCheckoutCompleted(session); // replay

  const children = await pgDb
    .select()
    .from(businesses)
    .where(eq(businesses.parentBusinessId, parent.id));
  assert.equal(children.length, 1, "duplicate webhook delivery must NOT create a second listing");
  createdBusinessIds.push(children[0].id);
});

test("missing parent business: handler exits gracefully without creating any listing", async () => {
  const session = makeSession({
    parentId: 999_999_999, // does not exist
    ownerUserId: "user-no-parent",
    zipCode: "27958",
    subscriptionId: "sub_no_parent",
    customerId: "cus_no_parent",
  });

  await handleAdditionalZipCheckoutCompleted(session);

  const orphans = await pgDb
    .select()
    .from(businesses)
    .where(eq(businesses.stripeSubscriptionId, "sub_no_parent"));
  assert.equal(orphans.length, 0, "no listing should be created when the parent is missing");
});

test("missing required metadata is a no-op (no listing created)", async () => {
  const parent = await seedParent({ name: "Add Zip Parent Bad Meta" });
  const badSession = {
    id: "cs_bad_meta",
    metadata: { type: "additional_zip", parentBusinessId: String(parent.id) /* zipCode missing */ },
    subscription: "sub_bad_meta",
    customer: "cus_bad_meta",
  } as unknown as Stripe.Checkout.Session;

  await handleAdditionalZipCheckoutCompleted(badSession);

  const children = await pgDb
    .select()
    .from(businesses)
    .where(or(eq(businesses.parentBusinessId, parent.id), eq(businesses.stripeSubscriptionId, "sub_bad_meta")));
  assert.equal(children.length, 0, "incomplete metadata must short-circuit");
});

test("falls back to parent's stripeCustomerId when the session has no customer attached", async () => {
  const parent = await seedParent({
    name: "Add Zip Parent Fallback",
    stripeCustomerId: "cus_parent_fallback_only",
  });
  const session = makeSession({
    parentId: parent.id,
    ownerUserId: "user-addzip-fallback-" + Date.now(),
    zipCode: "27947",
    subscriptionId: "sub_addzip_fallback",
    customerId: null, // force fallback
  });

  await handleAdditionalZipCheckoutCompleted(session);

  const [child] = await pgDb
    .select()
    .from(businesses)
    .where(eq(businesses.parentBusinessId, parent.id));
  assert.ok(child, "child listing must still be created");
  createdBusinessIds.push(child.id);
  assert.equal(child.stripeCustomerId, "cus_parent_fallback_only", "must inherit the parent's customer when session lacks one");
});
