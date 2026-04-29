// Regression test for the Stripe webhook signature gate.
//
// The `/api/stripe/webhook` route accepts events that mint money or
// credits (credit-pack purchases, referral payouts via
// `invoice.payment_succeeded`, ad/job activation, comp membership grants).
// In production we MUST require a verified Stripe signature on every
// event, otherwise an attacker who can reach the public webhook URL can
// forge any of those events and grant themselves money/credits.
//
// We had a previous gate that only protected `checkout.session.completed`
// for `metadata.type === "credit_pack"`, which left
// `invoice.payment_succeeded` (the referral payout trigger) wide open.
// This test pins the broader fix: in production, ANY unverified event
// is rejected with 400.
//
// We exercise the `invoice.payment_succeeded` branch specifically (the
// one the gap was found in), not just credit_pack, so a future regression
// that re-narrows the gate to only credit_pack is caught.

process.env.NODE_ENV = "production";
process.env.Stripeintegration = process.env.Stripeintegration || "sk_test_dummy_for_route_registration";
// Intentionally do NOT set STRIPE_WEBHOOK_SECRET — that's the whole point:
// even when the secret is misconfigured/missing, prod must fail closed.
delete process.env.STRIPE_WEBHOOK_SECRET;

import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { AddressInfo } from "node:net";

import { registerStripeRoutes } from "../stripe";

let baseUrl = "";
let server: ReturnType<express.Express["listen"]>;

before(async () => {
  const app = express();
  // Mirror server/index.ts: capture rawBody so the real signature path
  // would have something to verify against (we don't send a sig anyway,
  // we just want the route to be reachable the same way prod sees it).
  app.use(express.json({
    verify: (req: any, _res, buf) => { req.rawBody = buf; },
  }));
  registerStripeRoutes(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, () => resolve());
  });
  const port = (server.address() as AddressInfo).port;
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

async function postWebhook(body: any, headers: Record<string, string> = {}) {
  return fetch(`${baseUrl}/api/stripe/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

test("stripe webhook: in production, an unsigned `invoice.payment_succeeded` (referral payout trigger) is rejected with 400", async () => {
  // Forge a payload that, if accepted, would run the referral-payout
  // branch in server/stripe.ts and call processReferralOnFirstPaidInvoice.
  // We construct a realistic-looking Stripe.Invoice envelope.
  const forged = {
    id: "evt_forged_invoice_paid",
    type: "invoice.payment_succeeded",
    data: {
      object: {
        id: "in_forged",
        customer: "cus_forged",
        subscription: "sub_forged",
        amount_paid: 999900, // $9,999 — high enough that an attacker would care
        billing_reason: "subscription_create",
        metadata: { businessId: "1" },
      },
    },
  };

  const res = await postWebhook(forged); // no stripe-signature header
  assert.equal(
    res.status,
    400,
    "production must reject unverified invoice.payment_succeeded — referral credit could be forged otherwise",
  );
});

test("stripe webhook: in production, an unsigned `checkout.session.completed` credit_pack is also still rejected (regression)", async () => {
  const forged = {
    id: "evt_forged_credit_pack",
    type: "checkout.session.completed",
    data: {
      object: {
        id: "cs_forged",
        payment_status: "paid",
        amount_total: 4999,
        metadata: { type: "credit_pack", businessId: "1", creditsCents: "5000" },
      },
    },
  };
  const res = await postWebhook(forged);
  assert.equal(res.status, 400, "credit_pack forgery must remain blocked");
});

test("stripe webhook: in production, an unsigned `customer.subscription.updated` (no money minted, but still mutates state) is rejected by the same gate", async () => {
  // The same unverified-rejection contract should hold for ANY event in
  // production — not just the two we know mint money. This pins the
  // "fail closed for the whole handler" invariant.
  const forged = {
    id: "evt_forged_sub_updated",
    type: "customer.subscription.updated",
    data: { object: { id: "sub_forged", customer: "cus_forged", status: "active" } },
  };
  const res = await postWebhook(forged);
  assert.equal(res.status, 400, "production must fail closed for ALL unverified events");
});

test("stripe webhook: when stripe-signature header is present but invalid, request is rejected with 400 (existing constructEvent path)", async () => {
  // With STRIPE_WEBHOOK_SECRET unset, the new-fail-closed branch is what
  // catches this. The shape of the event doesn't matter — we just want to
  // confirm a forged sig doesn't sneak through.
  const forged = {
    id: "evt_forged_with_bad_sig",
    type: "invoice.payment_succeeded",
    data: { object: { id: "in_x", customer: "cus_x", subscription: "sub_x", amount_paid: 100 } },
  };
  const res = await postWebhook(forged, { "stripe-signature": "t=1,v1=deadbeef" });
  assert.equal(res.status, 400);
});
