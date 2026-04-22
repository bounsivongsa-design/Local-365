// Tests for processReferralOnFirstPaidInvoice — the Stripe webhook hook
// that turns a 'pending' referral into a 'rewarded' one and credits the
// referrer's customer balance. Stripe is fully stubbed; we verify the
// DB row transitions and the credit-call shape, plus the rollback path
// for downstream failures.
process.env.RESEND_API_KEY = "";

import test, { before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { eq, inArray } from "drizzle-orm";
import type Stripe from "stripe";

import { db as pgDb } from "../db";
import { businesses, referrals } from "@shared/schema";
import { processReferralOnFirstPaidInvoice } from "../referrals";

const TEST_TAG = "__process_referral_test__";

let createdBusinessIds: number[] = [];

async function seedBusiness(opts: {
  name: string;
  membershipTier?: "basic" | "standard" | "premium";
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
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
      membershipTier: opts.membershipTier ?? "basic",
      stripeCustomerId: opts.stripeCustomerId ?? null,
      stripeSubscriptionId: opts.stripeSubscriptionId ?? null,
    })
    .returning();
  createdBusinessIds.push(row.id);
  return row;
}

async function seedPendingReferral(referrerId: number, referredId: number) {
  const [row] = await pgDb
    .insert(referrals)
    .values({
      referrerBusinessId: referrerId,
      referredBusinessId: referredId,
      code: "REF-TESTXX",
      status: "pending",
    })
    .returning();
  return row;
}

async function cleanup() {
  if (createdBusinessIds.length === 0) return;
  await pgDb.delete(referrals).where(inArray(referrals.referrerBusinessId, createdBusinessIds));
  await pgDb.delete(referrals).where(inArray(referrals.referredBusinessId, createdBusinessIds));
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
    await pgDb.delete(referrals).where(inArray(referrals.referrerBusinessId, ids));
    await pgDb.delete(referrals).where(inArray(referrals.referredBusinessId, ids));
    await pgDb.delete(businesses).where(inArray(businesses.id, ids));
  }
});

beforeEach(async () => {
  await cleanup();
});

after(async () => {
  await cleanup();
});

type BalanceCall = {
  customerId: string;
  amount: number;
  currency: string;
  metadata: Record<string, string>;
  idempotencyKey: string | undefined;
};

function makeStripe(opts: {
  referrerSubUnitAmount?: number;
  referrerSubInterval?: "month" | "year";
  failBalanceTransaction?: boolean;
} = {}) {
  const calls: BalanceCall[] = [];
  const subRetrieves: string[] = [];
  const stripe = {
    subscriptions: {
      retrieve: async (id: string) => {
        subRetrieves.push(id);
        return {
          id,
          items: {
            data: [
              {
                price: {
                  unit_amount: opts.referrerSubUnitAmount ?? 5000,
                  recurring: {
                    interval: opts.referrerSubInterval ?? "month",
                    interval_count: 1,
                  },
                },
              },
            ],
          },
        };
      },
    },
    customers: {
      createBalanceTransaction: async (
        customerId: string,
        params: { amount: number; currency: string; metadata: Record<string, string> },
        options: { idempotencyKey: string },
      ) => {
        if (opts.failBalanceTransaction) {
          throw new Error("stripe down");
        }
        calls.push({
          customerId,
          amount: params.amount,
          currency: params.currency,
          metadata: params.metadata,
          idempotencyKey: options?.idempotencyKey,
        });
        return { id: "txn_test_" + calls.length };
      },
    },
  };
  return { stripe: stripe as unknown as Stripe, calls, subRetrieves };
}

function makeInvoice(opts: {
  amountPaid?: number;
  status?: "paid" | "open" | "draft" | "void" | "uncollectible";
  subscription?: string | null;
}): Stripe.Invoice {
  return {
    id: "in_test",
    amount_paid: opts.amountPaid ?? 2500,
    status: opts.status ?? "paid",
    subscription: opts.subscription ?? null,
  } as unknown as Stripe.Invoice;
}

test("happy path: a paid invoice rewards the referrer with one month's credit and finalizes the row", async () => {
  const referrer = await seedBusiness({
    name: "Happy Referrer",
    membershipTier: "standard",
    stripeCustomerId: "cus_referrer_happy",
    stripeSubscriptionId: "sub_referrer_happy",
  });
  const referred = await seedBusiness({
    name: "Happy Referred",
    stripeSubscriptionId: "sub_referred_happy",
  });
  const pending = await seedPendingReferral(referrer.id, referred.id);

  const { stripe, calls } = makeStripe({ referrerSubUnitAmount: 5000 });
  const invoice = makeInvoice({ amountPaid: 5000, subscription: "sub_referred_happy" });

  const result = await processReferralOnFirstPaidInvoice({
    referredBusinessId: referred.id,
    invoice,
    stripe,
  });

  assert.equal(result.rewarded, true);
  assert.equal(result.creditCents, 5000);

  assert.equal(calls.length, 1, "exactly one Stripe credit call");
  assert.equal(calls[0].customerId, "cus_referrer_happy");
  assert.equal(calls[0].amount, -5000, "amount must be negative (a credit)");
  assert.equal(calls[0].currency, "usd");
  assert.equal(calls[0].metadata.referralId, String(pending.id));
  assert.equal(calls[0].idempotencyKey, `referral-credit-${pending.id}`);

  const [row] = await pgDb.select().from(referrals).where(eq(referrals.id, pending.id));
  assert.equal(row.status, "rewarded");
  assert.equal(row.creditAmountCents, 5000);
  assert.ok(row.rewardedAt, "rewardedAt timestamp must be set");
});

test("annual subscription is normalized to a one-MONTH credit, not one full billing period", async () => {
  const referrer = await seedBusiness({
    name: "Annual Referrer",
    membershipTier: "premium",
    stripeCustomerId: "cus_annual",
    stripeSubscriptionId: "sub_annual",
  });
  const referred = await seedBusiness({
    name: "Annual Referred",
    stripeSubscriptionId: "sub_referred_annual",
  });
  await seedPendingReferral(referrer.id, referred.id);

  const { stripe, calls } = makeStripe({
    referrerSubUnitAmount: 120000, // $1,200/yr
    referrerSubInterval: "year",
  });
  const invoice = makeInvoice({ amountPaid: 10000, subscription: "sub_referred_annual" });

  const result = await processReferralOnFirstPaidInvoice({
    referredBusinessId: referred.id,
    invoice,
    stripe,
  });

  assert.equal(result.rewarded, true);
  assert.equal(result.creditCents, 10000, "annual $1,200 / 12 = $100 monthly credit");
  assert.equal(calls[0].amount, -10000);
});

test("$0 trial-creation invoice does not reward (only real money triggers payout)", async () => {
  const referrer = await seedBusiness({
    name: "Trial Referrer",
    stripeCustomerId: "cus_trial",
    stripeSubscriptionId: "sub_trial",
  });
  const referred = await seedBusiness({
    name: "Trial Referred",
    stripeSubscriptionId: "sub_referred_trial",
  });
  const pending = await seedPendingReferral(referrer.id, referred.id);

  const { stripe, calls } = makeStripe();
  const invoice = makeInvoice({ amountPaid: 0, subscription: "sub_referred_trial" });

  const result = await processReferralOnFirstPaidInvoice({
    referredBusinessId: referred.id,
    invoice,
    stripe,
  });

  assert.equal(result.rewarded, false);
  assert.equal(result.reason, "zero amount invoice");
  assert.equal(calls.length, 0, "Stripe must not be called");

  const [row] = await pgDb.select().from(referrals).where(eq(referrals.id, pending.id));
  assert.equal(row.status, "pending", "row must remain pending so a future paid invoice can claim it");
});

test("an invoice for a NON-membership subscription (e.g. a job listing) does not pay out and rolls the row back to pending", async () => {
  const referrer = await seedBusiness({
    name: "Wrong Sub Referrer",
    stripeCustomerId: "cus_wrong",
    stripeSubscriptionId: "sub_wrong_referrer",
  });
  const referred = await seedBusiness({
    name: "Wrong Sub Referred",
    stripeSubscriptionId: "sub_membership_real",
  });
  const pending = await seedPendingReferral(referrer.id, referred.id);

  const { stripe, calls } = makeStripe();
  const invoice = makeInvoice({
    amountPaid: 2500,
    // This invoice is for a different subscription (e.g. a job listing),
    // not the referee's membership sub. The function must reject it.
    subscription: "sub_some_other_thing",
  });

  const result = await processReferralOnFirstPaidInvoice({
    referredBusinessId: referred.id,
    invoice,
    stripe,
  });

  assert.equal(result.rewarded, false);
  assert.equal(calls.length, 0, "must NOT issue a credit when sub IDs don't match");

  const [row] = await pgDb.select().from(referrals).where(eq(referrals.id, pending.id));
  assert.equal(row.status, "pending", "row must be rolled back so a real payment later can still claim it");
});

test("if the Stripe credit call throws, the row is rolled back to pending (so the next webhook delivery retries)", async () => {
  const referrer = await seedBusiness({
    name: "Failing Referrer",
    stripeCustomerId: "cus_fail",
    stripeSubscriptionId: "sub_fail_referrer",
  });
  const referred = await seedBusiness({
    name: "Failing Referred",
    stripeSubscriptionId: "sub_referred_fail",
  });
  const pending = await seedPendingReferral(referrer.id, referred.id);

  const { stripe } = makeStripe({ failBalanceTransaction: true });
  const invoice = makeInvoice({ amountPaid: 2500, subscription: "sub_referred_fail" });

  const result = await processReferralOnFirstPaidInvoice({
    referredBusinessId: referred.id,
    invoice,
    stripe,
  });

  assert.equal(result.rewarded, false);
  assert.match(result.reason ?? "", /stripe down/);

  const [row] = await pgDb.select().from(referrals).where(eq(referrals.id, pending.id));
  assert.equal(row.status, "pending", "transient failure must NOT permanently consume the referral");
  assert.equal(row.creditAmountCents, null);
});

test("founder/comp referrers (no stripeCustomerId) get the Gold-days fallback and the row still finalizes — but creditAmountCents stays null so reporting stays honest", async () => {
  const referrer = await seedBusiness({
    name: "Founder Referrer",
    stripeCustomerId: null,
    stripeSubscriptionId: null,
  });
  const referred = await seedBusiness({
    name: "Founder Referred",
    stripeSubscriptionId: "sub_referred_founder",
  });
  const pending = await seedPendingReferral(referrer.id, referred.id);

  const { stripe, calls } = makeStripe();
  const invoice = makeInvoice({ amountPaid: 2500, subscription: "sub_referred_founder" });

  const result = await processReferralOnFirstPaidInvoice({
    referredBusinessId: referred.id,
    invoice,
    stripe,
  });

  assert.equal(result.rewarded, true, "fallback path still rewards");
  assert.equal(calls.length, 0, "no Stripe credit call when there's no customer id");

  const [row] = await pgDb.select().from(referrals).where(eq(referrals.id, pending.id));
  assert.equal(row.status, "rewarded");
  assert.equal(
    row.creditAmountCents,
    null,
    "no dollar credit was actually issued, so the column must stay null",
  );

  const [refRow] = await pgDb
    .select({ goldEnd: businesses.goldTrialEndDate })
    .from(businesses)
    .where(eq(businesses.id, referrer.id));
  assert.ok(refRow.goldEnd, "fallback should extend the referrer's Gold trial");
  assert.ok(
    new Date(refRow.goldEnd!).getTime() > Date.now() + 25 * 24 * 3600 * 1000,
    "Gold extension must be ~30 days into the future",
  );

  void pending;
});

test("when there is no pending referral for the referee, the function is a no-op", async () => {
  const referred = await seedBusiness({
    name: "Lonely Referred",
    stripeSubscriptionId: "sub_lonely",
  });
  const { stripe, calls } = makeStripe();
  const invoice = makeInvoice({ amountPaid: 2500, subscription: "sub_lonely" });

  const result = await processReferralOnFirstPaidInvoice({
    referredBusinessId: referred.id,
    invoice,
    stripe,
  });

  assert.equal(result.rewarded, false);
  assert.equal(result.reason, "no pending referral");
  assert.equal(calls.length, 0);
});
