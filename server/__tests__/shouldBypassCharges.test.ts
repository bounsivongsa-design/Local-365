// Regression tests for the charge-bypass helpers in server/lib/founderRules.ts,
// used by every Stripe checkout endpoint (membership, ad placement, job
// listing, event ad, additional-zip).
//
// Two layers are tested here:
//
//  1. isFounderOrAdmin(user, biz) — the DURABLE founder/admin rule, true
//     regardless of the growth-period switch. Before this helper existed,
//     ad/job/event checkouts ONLY matched on FOUNDER_BUSINESSES by normalized
//     business name, so a founder whose business was saved with an ABBREVIATED
//     name (e.g. "Blackwater Tech Solutions" vs the canonical "Blackwater
//     Technology Solutions") would silently get billed. The 3-pronged chain:
//       1. accountType === "admin" (admin override — works regardless of biz)
//       2. founder email allowlist (works even if biz name is wrong/missing)
//       3. founder business name match (legacy path, kept for backwards compat)
//
//  2. shouldBypassMembershipCharges — membership dues + additional-zip: FREE
//     for everyone while NO_CHARGE_MODE is on (growth period).
//  3. shouldBypassCharges — discrete purchases (ads, event ads, job posts, AI
//     packs): ALWAYS charged, EXCEPT founders/admins, legacy founding members,
//     and businesses with an active admin comp. NOT tied to NO_CHARGE_MODE.
//     We also lock in that NO_CHARGE_MODE does NOT leak into AI-credit bypass.
process.env.RESEND_API_KEY = "";

import test from "node:test";
import assert from "node:assert/strict";
import { shouldBypassCharges } from "../stripe";
import {
  isFounderOrAdmin,
  shouldBypassAiCredits,
  shouldBypassMembershipCharges,
  NO_CHARGE_MODE,
} from "../lib/founderRules";

test("isFounderOrAdmin: admin user always matches, regardless of business", () => {
  const adminUser = { accountType: "admin", email: "anyone@example.com" };
  assert.equal(isFounderOrAdmin(adminUser, { name: "Random LLC" }), true);
  assert.equal(isFounderOrAdmin(adminUser, { name: null }), true);
  assert.equal(isFounderOrAdmin(adminUser, null), true);
});

test("isFounderOrAdmin: founder email matches even when business name is non-founder", () => {
  // Boun's email is in FOUNDER_EMAILS — should match even if his business
  // is saved under a totally different name.
  const founderEmailUser = {
    accountType: "business",
    email: "boun.sivongsa@gmail.com",
  };
  assert.equal(isFounderOrAdmin(founderEmailUser, { name: "Some Random Business Name" }), true);
  assert.equal(isFounderOrAdmin(founderEmailUser, null), true);
});

test("isFounderOrAdmin: founder business name matches even for non-founder/non-admin user", () => {
  // Edge case: someone other than Boun is logged in as the linked owner of
  // a founder business (e.g. a comped admin assistant). The business itself
  // still gets the founder match.
  const plainUser = { accountType: "business", email: "assistant@example.com" };
  assert.equal(
    isFounderOrAdmin(plainUser, { name: "Blackwater Technology Solutions, LLC" }),
    true,
  );
  assert.equal(
    isFounderOrAdmin(plainUser, { name: "Goat Locker Printing" }),
    true,
  );
});

test("isFounderOrAdmin: returns FALSE for ordinary business + ordinary email + non-founder business name", () => {
  // The main negative case — make sure the DURABLE rule doesn't accidentally
  // treat real paying customers as founders. (When billing resumes, this is
  // what shouldBypassCharges falls back to.)
  const regularUser = { accountType: "business", email: "joe@joeslawn.com" };
  assert.equal(
    isFounderOrAdmin(regularUser, { name: "Joe's Lawn Care" }),
    false,
  );
});

test("isFounderOrAdmin: returns FALSE for null user + null business (defensive)", () => {
  assert.equal(isFounderOrAdmin(null, null), false);
  assert.equal(isFounderOrAdmin(undefined, undefined), false);
});

test("isFounderOrAdmin: founder email check is case-insensitive", () => {
  // Resend/OAuth providers occasionally upper-case email portions; the
  // allowlist match should still hit so we don't accidentally charge a
  // founder because of email casing drift.
  const upperUser = { accountType: "business", email: "Boun.Sivongsa@GMAIL.com" };
  assert.equal(isFounderOrAdmin(upperUser, { name: "Whatever" }), true);
});

test("isFounderOrAdmin: ABBREVIATED founder business name still matches via founder email (the original bug)", () => {
  // The actual regression that drove this whole helper: Boun's business was
  // saved in the DB as "Blackwater Tech Solutions" (abbreviated) instead of
  // the canonical "Blackwater Technology Solutions" in FOUNDER_BUSINESSES.
  // The name normalizer strips "LLC/Inc/Corp/Ltd/Co" but does NOT expand
  // "Tech" to "Technology" — so the name-only match would FAIL here.
  // The match MUST still trigger because the email is in FOUNDER_EMAILS.
  const founderEmailAbbrevBiz = {
    accountType: "business",
    email: "boun.sivongsa@gmail.com",
  };
  const abbreviatedBiz = { name: "Blackwater Tech Solutions" };
  assert.equal(isFounderOrAdmin(founderEmailAbbrevBiz, abbreviatedBiz), true);

  // Sanity: a NON-founder email + same abbreviated biz name => NO match.
  // (The biz name doesn't normalize to "Blackwater Technology Solutions",
  // so the name path can't save it. This proves the email path is doing
  // the work in the row above, not a hidden name-fuzzy-match.)
  const strangerSameBiz = { accountType: "business", email: "stranger@example.com" };
  assert.equal(isFounderOrAdmin(strangerSameBiz, abbreviatedBiz), false);
});

// ---------------------------------------------------------------------------
// Membership surfaces (membership dues + additional-zip): FREE in growth mode
// ---------------------------------------------------------------------------

test("shouldBypassMembershipCharges: founders/admins always bypass", () => {
  const adminUser = { accountType: "admin", email: "anyone@example.com" };
  const founderEmailUser = { accountType: "business", email: "boun.sivongsa@gmail.com" };
  assert.equal(shouldBypassMembershipCharges(adminUser, { name: "Random LLC" }), true);
  assert.equal(shouldBypassMembershipCharges(founderEmailUser, { name: "Some Random Business" }), true);
});

test("shouldBypassMembershipCharges: while NO_CHARGE_MODE is on, membership is FREE for everyone", () => {
  // Growth mode waives RECURRING membership dues (and additional-zip) for
  // every business, even an ordinary paying customer.
  const regularUser = { accountType: "business", email: "joe@joeslawn.com" };
  if (NO_CHARGE_MODE) {
    assert.equal(shouldBypassMembershipCharges(regularUser, { name: "Joe's Lawn Care" }), true);
    assert.equal(shouldBypassMembershipCharges(null, null), true);
  } else {
    // Billing has resumed — falls back to the founder/admin rule.
    assert.equal(shouldBypassMembershipCharges(regularUser, { name: "Joe's Lawn Care" }), false);
    assert.equal(shouldBypassMembershipCharges(null, null), false);
  }
});

// ---------------------------------------------------------------------------
// Discrete purchases (ads, event ads, job posts, AI packs): CHARGED even in
// growth mode, EXCEPT founders/admins, founding members, and active comps.
// ---------------------------------------------------------------------------

test("shouldBypassCharges: founders/admins always bypass discrete purchases", () => {
  const adminUser = { accountType: "admin", email: "anyone@example.com" };
  const founderEmailUser = { accountType: "business", email: "boun.sivongsa@gmail.com" };
  assert.equal(shouldBypassCharges(adminUser, { name: "Random LLC" }), true);
  assert.equal(shouldBypassCharges(founderEmailUser, { name: "Some Random Business" }), true);
});

test("shouldBypassCharges: ordinary paying customers ARE charged for discrete purchases (even during growth mode)", () => {
  // Unlike membership, discrete purchases (ads/events/jobs/AI packs) are NOT
  // waived by the growth switch — ordinary businesses must still pay.
  const regularUser = { accountType: "business", email: "joe@joeslawn.com" };
  assert.equal(shouldBypassCharges(regularUser, { name: "Joe's Lawn Care", isFoundingMember: false }), false);
  assert.equal(shouldBypassCharges(null, null), false);
});

test("shouldBypassCharges: legacy founding members bypass discrete purchases", () => {
  const regularUser = { accountType: "business", email: "joe@joeslawn.com" };
  assert.equal(
    shouldBypassCharges(regularUser, { name: "Joe's Lawn Care", isFoundingMember: true }),
    true,
  );
});

test("shouldBypassCharges: businesses with an ACTIVE admin comp bypass discrete purchases", () => {
  const regularUser = { accountType: "business", email: "joe@joeslawn.com" };
  // Active comp (indefinite — no expiry) => free.
  assert.equal(
    shouldBypassCharges(regularUser, {
      name: "Joe's Lawn Care",
      isCompedMembership: true,
      compedMembershipExpiresAt: null,
    }),
    true,
  );
  // Comp present but EXPIRED => charged.
  assert.equal(
    shouldBypassCharges(regularUser, {
      name: "Joe's Lawn Care",
      isCompedMembership: true,
      compedMembershipExpiresAt: new Date(Date.now() - 24 * 3600 * 1000),
    }),
    false,
  );
});

test("NO_CHARGE_MODE does NOT grant unlimited AI credits to ordinary businesses (cost guardrail)", () => {
  // Critical decoupling: making membership free must NOT silently hand every
  // business unlimited AI/SMS at the platform's own metered OpenAI cost.
  // Only founders/admins/legacy founding-members get the ∞ credit bypass.
  const regularUser = { accountType: "business", email: "joe@joeslawn.com" };
  assert.equal(shouldBypassAiCredits(regularUser, { name: "Joe's Lawn Care", isFoundingMember: false }), false);

  // ...but the durable founder/admin + legacy founding-member paths still do.
  const adminUser = { accountType: "admin", email: "admin@example.com" };
  assert.equal(shouldBypassAiCredits(adminUser, { name: "Whatever" }), true);
  assert.equal(shouldBypassAiCredits(regularUser, { name: "Joe's Lawn Care", isFoundingMember: true }), true);
});
