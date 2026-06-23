/**
 * Single source of truth for the founder/admin bypass rules.
 *
 * Background: the LocalList365 platform never charges (Stripe checkout)
 * or meters (AI credits, SMS credits) the platform owner / founding
 * founders / company-internal admin accounts. Historically this rule
 * was duplicated by-copy across `server/stripe.ts`, `server/multiZip.ts`,
 * `server/aiFeatures.ts`, and `server/sms.ts` — and they DID drift.
 * The most recent regression: Stripe correctly bypassed admins, but the
 * AI Credits widget (which only checked `business.isFoundingMember`)
 * showed admins "0 / 250 credits" and would have charged them on every
 * Gold-only AI tool call. This module exists so the next person who
 * adds a founder email or a founder business updates ONE list, and
 * every paid surface stays in lockstep.
 *
 * Two helpers are exported because the rule set genuinely differs by
 * surface:
 *
 *  - `shouldBypassCharges(user, biz)` — 3-prong rule used by EVERY
 *    real-money Stripe surface (membership checkout, ad placements,
 *    job listings, event ads, additional-zip subscriptions).
 *
 *  - `shouldBypassAiCredits(user, biz)` — 4-prong rule (= the 3 prongs
 *    plus legacy `business.isFoundingMember === true`) used by AI
 *    feature credit deduction AND the SMS Broadcast credit pool.
 *    The extra 4th prong exists because `is_founding_member` was the
 *    ORIGINAL founder-detection flag set by the founding-member referral
 *    pipeline; rows created via that path may not match by name/email
 *    but should still bypass.
 */

export const FOUNDER_BUSINESSES = [
  "Goat Locker Printing",
  "Blackwater Technology Solutions",
  "Back Bay Lawn Care",
];

export const FOUNDER_EMAILS = [
  "boun.sivongsa@gmail.com",
  "bsivongsa@blackwatertechnologysolutions.com",
  "boun.sivongsa@hotmail.com",
  "goatlockerprinting@gmail.com",
  "backbaylawncare2026@gmail.com",
];

/**
 * Lower-case + strip punctuation FIRST (commas, periods, parens) so
 * "Foo Inc., LLC" and "Foo (LLC.)" both reduce to the same canonical
 * form. Without that, the legal-suffix regex stripped "LLC" but left a
 * trailing comma, breaking founder-business matching for any name like
 * "Blackwater Tech, LLC".
 */
export function normalizeBusinessName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[,.()]/g, ' ')
    .replace(/\b(llc|inc|corp|ltd|co)\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function isFounderBusinessName(name: string | null | undefined): boolean {
  if (!name) return false;
  const normalized = normalizeBusinessName(name);
  return FOUNDER_BUSINESSES.some(fb => normalizeBusinessName(fb) === normalized);
}

export function isFounderEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return FOUNDER_EMAILS.some(fe => fe.toLowerCase() === email.toLowerCase());
}

/**
 * GROWTH-PERIOD KILL SWITCH — while true, NO ONE is charged real money on
 * ANY Stripe surface (membership signup, ads, job listings, event ads,
 * additional-zip listings). Every paid checkout is activated for free.
 *
 * Why this exists: during the customer/business acquisition phase the
 * platform is intentionally free so price is never a barrier to signing up.
 * Flip this to `false` (and redeploy) to resume billing.
 *
 * IMPORTANT: this only zeroes out real-money charges. It deliberately does
 * NOT grant everyone unlimited AI credits — `shouldBypassAiCredits` stays
 * metered (only true founders/admins get ∞) so the platform's own OpenAI /
 * SMS usage cost stays bounded even while membership is free.
 */
export const NO_CHARGE_MODE = true;

/**
 * The durable "this caller is a founder/admin" rule (independent of the
 * growth-period switch):
 *   1. user.accountType === "admin"
 *   2. user.email is in FOUNDER_EMAILS
 *   3. business.name normalizes to FOUNDER_BUSINESSES
 *
 * Defensive against null/undefined inputs.
 */
export function isFounderOrAdmin(
  user: { accountType?: string | null; email?: string | null } | null | undefined,
  biz: { name?: string | null } | null | undefined,
): boolean {
  if (user?.accountType === "admin") return true;
  if (isFounderEmail(user?.email)) return true;
  if (isFounderBusinessName(biz?.name)) return true;
  return false;
}

/**
 * Stripe-side bypass. Returns true if the caller should never be charged
 * money. True for EVERYONE while NO_CHARGE_MODE is on; otherwise only for
 * founders/admins.
 *
 * Defensive against null/undefined inputs.
 */
export function shouldBypassCharges(
  user: { accountType?: string | null; email?: string | null } | null | undefined,
  biz: { name?: string | null } | null | undefined,
): boolean {
  if (NO_CHARGE_MODE) return true;
  return isFounderOrAdmin(user, biz);
}

/**
 * Credit-pool bypass (AI features + SMS Broadcast). Returns true if the
 * caller should be treated as an unlimited (∞) founder for credit
 * purposes:
 *   1-3. founder/admin (isFounderOrAdmin)
 *   4. business.isFoundingMember === true   (legacy immutable flag)
 *
 * NOTE: intentionally NOT tied to NO_CHARGE_MODE — making membership free
 * must not silently hand every business unlimited AI/SMS at the platform's
 * own metered cost. Defensive against null/undefined inputs.
 */
export function shouldBypassAiCredits(
  user: { accountType?: string | null; email?: string | null } | null | undefined,
  biz: { name?: string | null; isFoundingMember?: boolean | null } | null | undefined,
): boolean {
  if (isFounderOrAdmin(user, biz)) return true;
  if (biz?.isFoundingMember === true) return true;
  return false;
}
