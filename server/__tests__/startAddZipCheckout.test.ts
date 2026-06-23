// Tests for startAddZipCheckoutForOwner — the function the
// POST /api/businesses/:id/add-zip-checkout route delegates to. These cover
// the *pre-Stripe* validation that gates whether we ever create a Stripe
// Checkout session at all (a regression here would silently let a buyer
// duplicate a listing in a zip they already own, or let someone start
// checkout for a listing they don't own), plus the happy-path verification
// that the session metadata we hand to Stripe is shaped correctly.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray, sql } from "drizzle-orm";
import type Stripe from "stripe";

import { db as pgDb } from "../db";
import { businesses, locations, users } from "@shared/schema";
import { startAddZipCheckoutForOwner, quoteAddZipForOwner, __setStripeForTesting } from "../multiZip";
import { NO_CHARGE_MODE } from "../lib/founderRules";

const TEST_TAG = "__addzip_checkout_route_test__";
const TEST_LOC_NAME = "__addzip_checkout_route_test_loc__";

// Zip codes used by these tests. We pick values unlikely to collide with the
// real seed data and mark our seeded `locations` row with a TEST_LOC_NAME so
// cleanup is trivial.
const COVERED_ZIP_A = "20991";
const COVERED_ZIP_B = "20992";
const UNCOVERED_ZIP = "20993";

let createdBusinessIds: number[] = [];
let createdUserIds: string[] = [];
let createdLocationIds: number[] = [];

async function seedBusiness(opts: {
  name: string;
  ownerUserId?: string | null;
  parentBusinessId?: number | null;
  isAdditionalZip?: boolean;
  zipCode?: string;
  status?: string;
  stripeCustomerId?: string | null;
  membershipTier?: string;
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
      zipCode: opts.zipCode ?? COVERED_ZIP_A,
      membershipTier: opts.membershipTier ?? "premium",
      stripeCustomerId: opts.stripeCustomerId ?? "cus_test_" + Math.random().toString(36).slice(2, 8),
      stripeSubscriptionId: null,
      ownerUserId: opts.ownerUserId ?? null,
      parentBusinessId: opts.parentBusinessId ?? null,
      isAdditionalZip: opts.isAdditionalZip ?? false,
      status: opts.status ?? "active",
      referralCode: `ADDZIPCHK-${Math.random().toString(36).slice(2, 10)}`,
      foundingMemberNumber: null,
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function seedUser(opts: { linkedBusinessId?: number | null } = {}) {
  const id = "user-addzip-checkout-" + Math.random().toString(36).slice(2, 10);
  await pgDb.insert(users).values({
    id,
    email: `${id}@example.com`,
    accountType: "business",
    linkedBusinessId: opts.linkedBusinessId ?? null,
  });
  createdUserIds.push(id);
  return id;
}

async function seedCoveredLocation(zips: string[]) {
  const [row] = await pgDb
    .insert(locations)
    .values({
      name: TEST_LOC_NAME,
      city: "Currituck",
      state: "NC",
      zipCodes: zips,
      region: "Outer Banks",
    })
    .returning();
  createdLocationIds.push(row.id);
  return row;
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
  if (createdLocationIds.length) {
    await pgDb.delete(locations).where(inArray(locations.id, createdLocationIds));
    createdLocationIds = [];
  }
}

before(async () => {
  // Sweep stragglers from prior failed runs.
  const bizStragglers = await pgDb
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.description, TEST_TAG));
  if (bizStragglers.length) {
    const ids = bizStragglers.map((s) => s.id);
    const children = await pgDb
      .select({ id: businesses.id })
      .from(businesses)
      .where(inArray(businesses.parentBusinessId, ids));
    const all = Array.from(new Set([...ids, ...children.map((c) => c.id)]));
    await pgDb.delete(businesses).where(inArray(businesses.id, all));
  }
  await pgDb.delete(locations).where(eq(locations.name, TEST_LOC_NAME));
  // Make sure none of our test zip codes are present in any other row's
  // zipCodes array — would otherwise make ownership/coverage checks ambiguous.
  for (const zc of [COVERED_ZIP_A, COVERED_ZIP_B, UNCOVERED_ZIP]) {
    await pgDb
      .update(locations)
      .set({ zipCodes: sql`array_remove(${locations.zipCodes}, ${zc})` })
      .where(sql`${zc} = ANY(COALESCE(${locations.zipCodes}, ARRAY[]::text[]))`);
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
  createCalls: Stripe.Checkout.SessionCreateParams[];
}

function makeStripeStub(returnUrl = "https://stripe.test/checkout/abc123"): StripeStub {
  const stub: StripeStub = {
    client: undefined as unknown as Stripe,
    createCalls: [],
  };
  stub.client = {
    checkout: {
      sessions: {
        create: async (params: Stripe.Checkout.SessionCreateParams) => {
          stub.createCalls.push(params);
          return { id: "cs_test_stub", url: returnUrl } as Stripe.Checkout.Session;
        },
      },
    },
  } as unknown as Stripe;
  return stub;
}

// ---------------------------------------------------------------------------
// Pre-Stripe validation
// ---------------------------------------------------------------------------

test("add-zip-checkout: 400 when zipCode is missing from the body", async () => {
  const userId = await seedUser();
  const biz = await seedBusiness({ name: "AddZip Missing Zip", ownerUserId: userId });

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(userId, biz.id, "", "example.test");

  assert.equal(result.status, 400);
  assert.match(String(result.body.message), /zipcode/i);
  assert.equal(stub.createCalls.length, 0, "Stripe must not be called when zip is missing");
});

test("add-zip-checkout: 403 when the caller does not own the listing", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  const ownerId = await seedUser();
  const owned = await seedBusiness({ name: "AddZip Owned By Other", ownerUserId: ownerId });
  const intruderId = await seedUser();

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(intruderId, owned.id, COVERED_ZIP_B, "example.test");

  assert.equal(result.status, 403);
  assert.match(String(result.body.message), /not your listing/i);
  assert.equal(stub.createCalls.length, 0, "Stripe must not be called for non-owners");
});

test("add-zip-checkout: 400 when the requested zip is not in any covered location", async () => {
  // Note: deliberately do NOT seed a location that contains UNCOVERED_ZIP.
  const userId = await seedUser();
  const biz = await seedBusiness({ name: "AddZip Uncovered", ownerUserId: userId });

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(userId, biz.id, UNCOVERED_ZIP, "example.test");

  assert.equal(result.status, 400);
  assert.match(String(result.body.message), /coverage/i);
  assert.equal(stub.createCalls.length, 0, "Stripe must not be called for uncovered zips");
});

test("add-zip-checkout: 409 when the caller already owns an active listing in that zip (root listing)", async () => {
  await seedCoveredLocation([COVERED_ZIP_A]);
  const userId = await seedUser();
  // The owner's primary listing IS in COVERED_ZIP_A — must refuse to sell it again.
  const biz = await seedBusiness({ name: "AddZip Dup Root", ownerUserId: userId, zipCode: COVERED_ZIP_A });

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(userId, biz.id, COVERED_ZIP_A, "example.test");

  assert.equal(result.status, 409);
  assert.match(String(result.body.message), /already have a listing/i);
  assert.equal(stub.createCalls.length, 0, "Stripe must not be called for duplicate zips");
});

test("add-zip-checkout: 409 when a child listing under the same parent already covers that zip", async () => {
  await seedCoveredLocation([COVERED_ZIP_A, COVERED_ZIP_B]);
  const userId = await seedUser();
  const parent = await seedBusiness({ name: "AddZip Dup Parent", ownerUserId: userId, zipCode: COVERED_ZIP_A });
  // Existing additional-zip child already covers COVERED_ZIP_B.
  await seedBusiness({
    name: "AddZip Dup Existing Child",
    ownerUserId: userId,
    parentBusinessId: parent.id,
    isAdditionalZip: true,
    zipCode: COVERED_ZIP_B,
  });

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(userId, parent.id, COVERED_ZIP_B, "example.test");

  assert.equal(result.status, 409);
  assert.equal(stub.createCalls.length, 0, "Stripe must not be called when a sibling already owns that zip");
});

test("add-zip-checkout: 409 also fires when the caller targets the child listing rather than the root", async () => {
  // Defends the bug shape where switching to a child as the active listing
  // bypassed the duplicate check. The root walker should normalize to the
  // root before the existing-listing query runs.
  await seedCoveredLocation([COVERED_ZIP_A, COVERED_ZIP_B]);
  const userId = await seedUser();
  const parent = await seedBusiness({ name: "AddZip Dup Via Child Parent", ownerUserId: userId, zipCode: COVERED_ZIP_A });
  const child = await seedBusiness({
    name: "AddZip Dup Via Child",
    ownerUserId: userId,
    parentBusinessId: parent.id,
    isAdditionalZip: true,
    zipCode: COVERED_ZIP_B,
  });

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  // Target the child id, but the duplicate is in COVERED_ZIP_A (root's own zip).
  const result = await startAddZipCheckoutForOwner(userId, child.id, COVERED_ZIP_A, "example.test");

  assert.equal(result.status, 409);
  assert.equal(stub.createCalls.length, 0);
});

// ---------------------------------------------------------------------------
// Happy path: builds the Stripe Checkout session correctly
// ---------------------------------------------------------------------------

test("add-zip-checkout: happy path builds a Stripe Checkout session with the right metadata, customer, and price", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  const userId = await seedUser();
  const parent = await seedBusiness({
    name: "AddZip Happy Parent",
    ownerUserId: userId,
    zipCode: COVERED_ZIP_A,
    stripeCustomerId: "cus_happy_parent",
  });

  const stub = makeStripeStub("https://stripe.test/checkout/happy");
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(userId, parent.id, COVERED_ZIP_B, "myhost.example");

  assert.equal(result.status, 200);

  if (NO_CHARGE_MODE) {
    // Growth period: additional zips are free for EVERYONE, so checkout skips
    // Stripe entirely and activates the child listing directly.
    assert.equal(result.body.founderBypass, true);
    assert.equal(result.body.priceMonthly, 0, "no-charge mode: price must be $0");
    assert.equal(stub.createCalls.length, 0, "Stripe must NOT be called while no-charge mode is on");
    const freeChild = await pgDb.select().from(businesses).where(eq(businesses.id, Number(result.body.listingId)));
    assert.equal(freeChild.length, 1, "additional-zip child row must be inserted");
    assert.equal(freeChild[0].zipCode, COVERED_ZIP_B);
    assert.equal(freeChild[0].parentBusinessId, parent.id);
    assert.equal(freeChild[0].stripeSubscriptionId, null, "free listings must not carry a Stripe sub id");
    return;
  }

  assert.equal(result.body.url, "https://stripe.test/checkout/happy");
  assert.ok(typeof result.body.priceMonthly === "number" && (result.body.priceMonthly as number) > 0,
    "must report a positive monthly price to the frontend");

  assert.equal(stub.createCalls.length, 1, "Stripe.checkout.sessions.create called exactly once");
  const params = stub.createCalls[0];

  assert.equal(params.mode, "subscription");
  assert.equal(params.customer, "cus_happy_parent", "must reuse the parent's Stripe customer");

  // success/cancel URLs use the host we passed in.
  assert.ok(String(params.success_url).startsWith("https://myhost.example/dashboard"));
  assert.ok(String(params.success_url).includes(`addedZip=${COVERED_ZIP_B}`));
  assert.ok(String(params.cancel_url).includes(`canceledZip=${COVERED_ZIP_B}`));

  // Top-level metadata — every field the webhook will read.
  assert.equal(params.metadata?.type, "additional_zip");
  assert.equal(params.metadata?.parentBusinessId, String(parent.id), "parentBusinessId must be the ROOT listing id");
  assert.equal(params.metadata?.ownerUserId, userId);
  assert.equal(params.metadata?.zipCode, COVERED_ZIP_B);
  assert.equal(params.metadata?.city, "Currituck");
  assert.equal(params.metadata?.state, "NC");

  // Subscription metadata mirrors the top-level metadata (used on
  // subsequent invoice/subscription events).
  assert.equal(params.subscription_data?.metadata?.type, "additional_zip");
  assert.equal(params.subscription_data?.metadata?.parentBusinessId, String(parent.id));
  assert.equal(params.subscription_data?.metadata?.ownerUserId, userId);
  assert.equal(params.subscription_data?.metadata?.zipCode, COVERED_ZIP_B);

  // Line item: priced per the parent's effective tier, billed monthly in USD.
  const line = params.line_items?.[0];
  assert.ok(line, "must include exactly one line item");
  assert.equal(line.quantity, 1);
  assert.equal(line.price_data?.currency, "usd");
  assert.equal(line.price_data?.recurring?.interval, "month");
  assert.equal(
    line.price_data?.unit_amount,
    (result.body.priceMonthly as number) * 100,
    "unit_amount (cents) must equal priceMonthly (dollars) * 100",
  );
});

test("add-zip-checkout: founder/admin bypass — admin user gets the additional zip listing for free without ever calling Stripe (regression: 'admins were getting charged $50/mo on add-zip')", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  // Admin user — promoted via accountType, not a founder email.
  const adminId = "user-addzip-admin-" + Math.random().toString(36).slice(2, 10);
  await pgDb.insert(users).values({
    id: adminId,
    email: `${adminId}@example.com`,
    accountType: "admin",
    linkedBusinessId: null,
  });
  createdUserIds.push(adminId);

  const parent = await seedBusiness({
    name: "Some Random Admin-Owned Listing",
    ownerUserId: adminId,
    zipCode: COVERED_ZIP_A,
    stripeCustomerId: "cus_admin_should_not_be_used",
  });

  const stub = makeStripeStub("https://stripe.test/should-not-be-called");
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(adminId, parent.id, COVERED_ZIP_B, "myhost.example");

  assert.equal(result.status, 200);
  assert.equal(result.body.founderBypass, true, "must signal bypass to the client");
  assert.equal(result.body.priceMonthly, 0, "price must be reported as $0");
  assert.equal(stub.createCalls.length, 0, "Stripe.checkout.sessions.create must NOT be called for admins");

  // The child listing must actually exist now (the modal closed and we
  // told the user it was activated — the row had better be there).
  const child = await pgDb
    .select()
    .from(businesses)
    .where(eq(businesses.id, Number(result.body.listingId)));
  assert.equal(child.length, 1, "additional-zip child row must be inserted");
  assert.equal(child[0].zipCode, COVERED_ZIP_B);
  assert.equal(child[0].parentBusinessId, parent.id);
  assert.equal(child[0].isAdditionalZip, true);
  assert.equal(child[0].ownerUserId, adminId);
  assert.equal(child[0].status, "active");
  assert.equal(child[0].stripeSubscriptionId, null, "free listings must not carry a Stripe sub id");
  // Don't insert a Founding row for free admin/founder duplicates — those
  // numbers are reserved for real paying signups.
  assert.equal(child[0].isFoundingMember, false);
  assert.equal(child[0].foundingMemberNumber, null);
});

test("add-zip-checkout: founder/admin bypass — owner with a founder email (not admin, not founder business) also bypasses Stripe", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  // Plain business account, but the email matches FOUNDER_EMAILS_LOCAL.
  const founderEmailUserId = "user-addzip-founderEmail-" + Math.random().toString(36).slice(2, 10);
  await pgDb.insert(users).values({
    id: founderEmailUserId,
    email: "boun.sivongsa@gmail.com", // matches the founder allowlist
    accountType: "business",
    linkedBusinessId: null,
  });
  createdUserIds.push(founderEmailUserId);

  const parent = await seedBusiness({
    name: "Some Random Non-Founder Business Name",
    ownerUserId: founderEmailUserId,
    zipCode: COVERED_ZIP_A,
  });

  const stub = makeStripeStub("https://stripe.test/should-not-be-called");
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(founderEmailUserId, parent.id, COVERED_ZIP_B, "myhost.example");

  assert.equal(result.status, 200);
  assert.equal(result.body.founderBypass, true);
  assert.equal(stub.createCalls.length, 0, "Stripe must NOT be called for founder-email owners");
});

test("add-zip-checkout: founder/admin bypass — owner of a FOUNDER_BUSINESSES-listed business (e.g. 'Blackwater Technology Solutions, LLC') bypasses Stripe even with the LLC suffix and trailing comma", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  // Plain business account with a non-founder email.
  const ownerId = await seedUser();

  // The exact name pattern that broke before (commit 210cb50): trailing comma
  // before the legal suffix. The normalizer must strip BOTH and still match.
  const parent = await seedBusiness({
    name: "Blackwater Technology Solutions, LLC",
    ownerUserId: ownerId,
    zipCode: COVERED_ZIP_A,
  });

  const stub = makeStripeStub("https://stripe.test/should-not-be-called");
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(ownerId, parent.id, COVERED_ZIP_B, "myhost.example");

  assert.equal(result.status, 200);
  assert.equal(result.body.founderBypass, true);
  assert.equal(stub.createCalls.length, 0, "Stripe must NOT be called for founder businesses");
});

test("add-zip-quote: founder/admin bypass — admin sees priceMonthly: 0 and bypass: true so the confirmation modal shows free instead of $50/mo", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  const adminId = "user-addzip-quote-admin-" + Math.random().toString(36).slice(2, 10);
  await pgDb.insert(users).values({
    id: adminId,
    email: `${adminId}@example.com`,
    accountType: "admin",
    linkedBusinessId: null,
  });
  createdUserIds.push(adminId);

  const parent = await seedBusiness({
    name: "Quote-Bypass Admin Parent",
    ownerUserId: adminId,
    zipCode: COVERED_ZIP_A,
    membershipTier: "premium",
  });

  const result = await quoteAddZipForOwner(adminId, parent.id, COVERED_ZIP_B);

  assert.equal(result.status, 200);
  assert.equal(result.body.priceMonthly, 0, "admin quote must be $0");
  assert.equal(result.body.bypass, true, "admin quote must flag bypass for the client");
});

test("add-zip-checkout: when the caller targets a CHILD listing, parentBusinessId in metadata is the ROOT, and the root's Stripe customer is used", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  const userId = await seedUser();
  const root = await seedBusiness({
    name: "AddZip Root For Child Test",
    ownerUserId: userId,
    zipCode: COVERED_ZIP_A,
    stripeCustomerId: "cus_root_for_child",
  });
  const child = await seedBusiness({
    name: "AddZip Child For Child Test",
    ownerUserId: userId,
    parentBusinessId: root.id,
    isAdditionalZip: true,
    zipCode: "20999",
    stripeCustomerId: "cus_child_should_not_be_used",
  });

  const stub = makeStripeStub();
  __setStripeForTesting(stub.client);

  const result = await startAddZipCheckoutForOwner(userId, child.id, COVERED_ZIP_B, "myhost.example");

  assert.equal(result.status, 200);

  if (NO_CHARGE_MODE) {
    // No-charge mode: free activation, but the child must STILL be attached to
    // the ROOT (not the targeted child) so the listing graph stays flat.
    assert.equal(result.body.founderBypass, true);
    assert.equal(stub.createCalls.length, 0, "Stripe must NOT be called while no-charge mode is on");
    const freeChild = await pgDb.select().from(businesses).where(eq(businesses.id, Number(result.body.listingId)));
    assert.equal(freeChild.length, 1);
    assert.equal(freeChild[0].parentBusinessId, root.id,
      "new listing must attach to the ROOT, not the targeted child");
    return;
  }

  assert.equal(stub.createCalls.length, 1);
  const params = stub.createCalls[0];
  assert.equal(params.metadata?.parentBusinessId, String(root.id),
    "metadata.parentBusinessId must point at the root, not the targeted child");
  assert.equal(params.customer, "cus_root_for_child",
    "must use the ROOT's Stripe customer even when checkout was started from a child");
});

test("add-zip-checkout: 503 when Stripe isn't configured (and zip/owner checks all pass)", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  const userId = await seedUser();
  const parent = await seedBusiness({ name: "AddZip No Stripe", ownerUserId: userId, zipCode: COVERED_ZIP_A });

  __setStripeForTesting(null);

  const result = await startAddZipCheckoutForOwner(userId, parent.id, COVERED_ZIP_B, "example.test");

  if (NO_CHARGE_MODE) {
    // No-charge mode bypasses Stripe BEFORE the "is Stripe configured" guard,
    // so a missing Stripe client is irrelevant — the zip is added for free.
    assert.equal(result.status, 200);
    assert.equal(result.body.founderBypass, true);
    return;
  }

  assert.equal(result.status, 503);
  assert.match(String(result.body.message), /stripe/i);
});

// ---------------------------------------------------------------------------
// add-zip-quote: price preview the dashboard shows before redirecting to Stripe
// ---------------------------------------------------------------------------

test("add-zip-quote: 400 when zipCode is missing", async () => {
  const userId = await seedUser();
  const biz = await seedBusiness({ name: "AddZipQuote Missing Zip", ownerUserId: userId });
  const result = await quoteAddZipForOwner(userId, biz.id, "");
  assert.equal(result.status, 400);
});

test("add-zip-quote: 403 when the caller does not own the listing", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  const ownerId = await seedUser();
  const owned = await seedBusiness({ name: "AddZipQuote Owned By Other", ownerUserId: ownerId });
  const intruderId = await seedUser();
  const result = await quoteAddZipForOwner(intruderId, owned.id, COVERED_ZIP_B);
  assert.equal(result.status, 403);
});

test("add-zip-quote: 400 when the requested zip is not in any covered location", async () => {
  const userId = await seedUser();
  const biz = await seedBusiness({ name: "AddZipQuote Uncovered", ownerUserId: userId });
  const result = await quoteAddZipForOwner(userId, biz.id, UNCOVERED_ZIP);
  assert.equal(result.status, 400);
});

test("add-zip-quote: 409 when the caller already owns an active listing in that zip", async () => {
  await seedCoveredLocation([COVERED_ZIP_A]);
  const userId = await seedUser();
  const biz = await seedBusiness({
    name: "AddZipQuote Dup",
    ownerUserId: userId,
    zipCode: COVERED_ZIP_A,
  });
  const result = await quoteAddZipForOwner(userId, biz.id, COVERED_ZIP_A);
  assert.equal(result.status, 409);
});

test("add-zip-quote: happy path returns city/state/tier/priceMonthly for a covered, available zip", async () => {
  await seedCoveredLocation([COVERED_ZIP_B]);
  const userId = await seedUser();
  const parent = await seedBusiness({
    name: "AddZipQuote Happy",
    ownerUserId: userId,
    zipCode: COVERED_ZIP_A,
    membershipTier: "premium",
  });
  const result = await quoteAddZipForOwner(userId, parent.id, COVERED_ZIP_B);
  assert.equal(result.status, 200);
  assert.equal(result.body.zipCode, COVERED_ZIP_B);
  assert.equal(result.body.city, "Currituck");
  assert.equal(result.body.state, "NC");
  assert.equal(result.body.tier, "premium");
  if (NO_CHARGE_MODE) {
    // No-charge mode: the confirm modal must show $0 with the bypass flag.
    assert.equal(result.body.priceMonthly, 0, "no-charge mode: quote must show $0");
    assert.equal(result.body.bypass, true);
  } else {
    // premium → gold tier in TIER_ID_MAP → 50% off the $75 Gold monthly = $37.50
    assert.equal(result.body.priceMonthly, 37.5);
  }
});

test("add-zip-quote: when caller targets a CHILD listing, price reflects the ROOT's tier (not the child's)", async () => {
  // Regression guard: the dashboard's "Add another zip" confirm step must
  // show the same price the buyer will actually be charged. The server
  // checkout uses the ROOT's effective tier, so the quote must too — even
  // when the active listing is a child whose own membershipTier differs
  // from the root's.
  await seedCoveredLocation([COVERED_ZIP_B]);
  const userId = await seedUser();
  const root = await seedBusiness({
    name: "AddZipQuote Root Premium",
    ownerUserId: userId,
    zipCode: COVERED_ZIP_A,
    membershipTier: "premium", // gold tier → 50% off the $75 Gold monthly = $37.50
  });
  const child = await seedBusiness({
    name: "AddZipQuote Child Basic",
    ownerUserId: userId,
    parentBusinessId: root.id,
    isAdditionalZip: true,
    zipCode: "20999",
    membershipTier: "basic", // bronze tier → 10% off the $25 Bronze monthly = $22.50 — should NOT be used
  });

  const result = await quoteAddZipForOwner(userId, child.id, COVERED_ZIP_B);
  assert.equal(result.status, 200);
  assert.equal(result.body.tier, "premium", "must report the ROOT's tier, not the child's");
  if (NO_CHARGE_MODE) {
    assert.equal(result.body.priceMonthly, 0, "no-charge mode: quote must show $0");
    assert.equal(result.body.bypass, true);
  } else {
    assert.equal(result.body.priceMonthly, 37.5, "price must reflect the ROOT's tier discount");
  }
});
