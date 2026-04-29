// Regression tests for shouldBypassAiCredits — the unified founder/admin
// bypass helper used by every customer-facing AI tool route in
// server/aiFeatures.ts (Listing Writer, Review Reply, Quote Responder,
// Help Wanted, Event Description, Photo Caption, Deal Writer, SMS Drafter,
// Social Composer, Newsletter Draft, Review Request Draft).
//
// Why this matters: the AI suite originally only checked the immutable
// `businesses.isFoundingMember` column. That column is set ONLY by the
// founding-member referral signup pipeline — it's never set on:
//   - admin accounts (e.g. locallist365@gmail.com)
//   - founder emails on a business that wasn't created via the founder flow
//   - founder businesses imported through seed/comp/admin tier change
// As a result, the dashboard widget showed "0 / 250 credits" for admins +
// founders + Blackwater, and the AI tool routes would have returned
// INSUFFICIENT before any OpenAI call. Stripe checkouts already had a
// 3-pronged unified bypass; this test locks the same chain in for AI:
//   1. accountType === "admin"           (admin override — works always)
//   2. user.email in FOUNDER_EMAILS      (works even if biz name is wrong/missing)
//   3. isFounderBusinessName(biz.name)   (handles "LLC"/"Inc"/punctuation)
//   4. business.isFoundingMember === true (legacy immutable flag, kept)
process.env.RESEND_API_KEY = "";

import test from "node:test";
import assert from "node:assert/strict";
import { shouldBypassAiCredits } from "../aiFeatures";

test("shouldBypassAiCredits: admin user always bypasses, regardless of business", () => {
  const adminUser = { accountType: "admin", email: "anyone@example.com" };
  assert.equal(shouldBypassAiCredits(adminUser, { name: "Random LLC", isFoundingMember: false }), true);
  assert.equal(shouldBypassAiCredits(adminUser, { name: null, isFoundingMember: false }), true);
  assert.equal(shouldBypassAiCredits(adminUser, null), true);
});

test("shouldBypassAiCredits: founder email bypasses even when business name is non-founder and isFoundingMember=false", () => {
  // Boun's email is in FOUNDER_EMAILS — should bypass even if his business
  // is saved under a totally different name and the immutable founder flag
  // was never set.
  const founderEmailUser = {
    accountType: "business",
    email: "boun.sivongsa@gmail.com",
  };
  assert.equal(
    shouldBypassAiCredits(founderEmailUser, { name: "Some Random Business Name", isFoundingMember: false }),
    true,
  );
  assert.equal(shouldBypassAiCredits(founderEmailUser, null), true);
  // case-insensitive
  const upper = { accountType: "business", email: "BOUN.SIVONGSA@GMAIL.COM" };
  assert.equal(
    shouldBypassAiCredits(upper, { name: "Foo", isFoundingMember: false }),
    true,
  );
});

test("shouldBypassAiCredits: founder business name bypasses even for non-founder/non-admin user", () => {
  const plainUser = { accountType: "business", email: "assistant@example.com" };
  assert.equal(
    shouldBypassAiCredits(plainUser, { name: "Blackwater Technology Solutions, LLC", isFoundingMember: false }),
    true,
  );
  assert.equal(
    shouldBypassAiCredits(plainUser, { name: "Goat Locker Printing", isFoundingMember: false }),
    true,
  );
  // Punctuation + LLC suffix variations all normalize the same way.
  assert.equal(
    shouldBypassAiCredits(plainUser, { name: "Blackwater Technology Solutions Inc.", isFoundingMember: false }),
    true,
  );
});

test("shouldBypassAiCredits: legacy isFoundingMember=true still bypasses (backwards compat)", () => {
  const plainUser = { accountType: "business", email: "joe@example.com" };
  assert.equal(
    shouldBypassAiCredits(plainUser, { name: "Joe's Lawn Care", isFoundingMember: true }),
    true,
  );
});

test("shouldBypassAiCredits: returns FALSE for ordinary user + ordinary email + non-founder name + isFoundingMember=false", () => {
  // The main negative case — must NOT accidentally hand out unlimited AI
  // to real paying customers. A regression here would zero out AI revenue.
  const regularUser = { accountType: "business", email: "joe@joeslawn.com" };
  assert.equal(
    shouldBypassAiCredits(regularUser, { name: "Joe's Lawn Care", isFoundingMember: false }),
    false,
  );
});

test("shouldBypassAiCredits: defensive against null/undefined user and biz", () => {
  assert.equal(shouldBypassAiCredits(null, null), false);
  assert.equal(shouldBypassAiCredits(undefined, undefined), false);
  assert.equal(shouldBypassAiCredits({}, {}), false);
  assert.equal(shouldBypassAiCredits({ accountType: null, email: null }, { name: null, isFoundingMember: null }), false);
});
