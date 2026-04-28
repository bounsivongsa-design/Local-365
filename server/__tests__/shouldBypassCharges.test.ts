// Regression tests for shouldBypassCharges — the unified founder/admin
// bypass helper used by every Stripe checkout endpoint in server/stripe.ts
// (membership, ad placement, job listing, event ad).
//
// Why this matters: before this helper existed, ad/job/event checkouts ONLY
// matched on FOUNDER_BUSINESSES by normalized business name. That meant a
// founder/admin whose business was saved with an ABBREVIATED name (e.g.
// "Blackwater Tech Solutions" vs the canonical "Blackwater Technology
// Solutions") would silently get billed real money by Stripe instead of
// bypassing checkout. This test locks in the 3-pronged fallback chain:
//   1. accountType === "admin" (admin override — works regardless of biz)
//   2. founder email allowlist (works even if biz name is wrong/missing)
//   3. founder business name match (legacy path, kept for backwards compat)
process.env.RESEND_API_KEY = "";

import test from "node:test";
import assert from "node:assert/strict";
import { shouldBypassCharges } from "../stripe";

test("shouldBypassCharges: admin user always bypasses, regardless of business", () => {
  const adminUser = { accountType: "admin", email: "anyone@example.com" };
  assert.equal(shouldBypassCharges(adminUser, { name: "Random LLC" }), true);
  assert.equal(shouldBypassCharges(adminUser, { name: null }), true);
  assert.equal(shouldBypassCharges(adminUser, null), true);
});

test("shouldBypassCharges: founder email bypasses even when business name is non-founder", () => {
  // Boun's email is in FOUNDER_EMAILS — should bypass even if his business
  // is saved under a totally different name.
  const founderEmailUser = {
    accountType: "business",
    email: "boun.sivongsa@gmail.com",
  };
  assert.equal(shouldBypassCharges(founderEmailUser, { name: "Some Random Business Name" }), true);
  assert.equal(shouldBypassCharges(founderEmailUser, null), true);
});

test("shouldBypassCharges: founder business name bypasses even for non-founder/non-admin user", () => {
  // Edge case: someone other than Boun is logged in as the linked owner of
  // a founder business (e.g. a comped admin assistant). The business itself
  // still gets the founder bypass.
  const plainUser = { accountType: "business", email: "assistant@example.com" };
  assert.equal(
    shouldBypassCharges(plainUser, { name: "Blackwater Technology Solutions, LLC" }),
    true,
  );
  assert.equal(
    shouldBypassCharges(plainUser, { name: "Goat Locker Printing" }),
    true,
  );
});

test("shouldBypassCharges: returns FALSE for ordinary business + ordinary email + non-founder business name", () => {
  // The main negative case — make sure we don't accidentally bypass real
  // paying customers. A regression here would let any logged-in business
  // owner stop paying for ads/jobs/events.
  const regularUser = { accountType: "business", email: "joe@joeslawn.com" };
  assert.equal(
    shouldBypassCharges(regularUser, { name: "Joe's Lawn Care" }),
    false,
  );
});

test("shouldBypassCharges: returns FALSE for null user + null business (defensive)", () => {
  assert.equal(shouldBypassCharges(null, null), false);
  assert.equal(shouldBypassCharges(undefined, undefined), false);
});

test("shouldBypassCharges: founder email check is case-insensitive", () => {
  // Resend/OAuth providers occasionally upper-case email portions; the
  // allowlist match should still hit so we don't accidentally charge a
  // founder because of email casing drift.
  const upperUser = { accountType: "business", email: "Boun.Sivongsa@GMAIL.com" };
  assert.equal(shouldBypassCharges(upperUser, { name: "Whatever" }), true);
});

test("shouldBypassCharges: ABBREVIATED founder business name still bypasses via founder email (the original bug)", () => {
  // The actual regression that drove this whole helper: Boun's business was
  // saved in the DB as "Blackwater Tech Solutions" (abbreviated) instead of
  // the canonical "Blackwater Technology Solutions" in FOUNDER_BUSINESSES.
  // The name normalizer strips "LLC/Inc/Corp/Ltd/Co" but does NOT expand
  // "Tech" to "Technology" — so the name-only match would FAIL here.
  // The bypass MUST still trigger because the email is in FOUNDER_EMAILS.
  // Without this guard the user gets billed real Stripe money to make an ad.
  const founderEmailAbbrevBiz = {
    accountType: "business",
    email: "boun.sivongsa@gmail.com",
  };
  const abbreviatedBiz = { name: "Blackwater Tech Solutions" };
  assert.equal(shouldBypassCharges(founderEmailAbbrevBiz, abbreviatedBiz), true);

  // Sanity: a NON-founder email + same abbreviated biz name => NO bypass.
  // (The biz name doesn't normalize to "Blackwater Technology Solutions",
  // so the name path can't save it. This proves the email path is doing
  // the work in the row above, not a hidden name-fuzzy-match.)
  const strangerSameBiz = { accountType: "business", email: "stranger@example.com" };
  assert.equal(shouldBypassCharges(strangerSameBiz, abbreviatedBiz), false);
});
