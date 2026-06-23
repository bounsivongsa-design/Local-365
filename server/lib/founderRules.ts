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
 * Three helpers are exported because the rule set genuinely differs by
 * surface:
 *
 *  - `shouldBypassMembershipCharges(user, biz)` — used by the RECURRING
 *    "membership" surfaces (membership tier checkout + additional-zip
 *    listings). FREE for everyone while NO_CHARGE_MODE is on (growth
 *    period); otherwise only founders/admins.
 *
 *  - `shouldBypassCharges(user, biz)` — used by DISCRETE paid purchases
 *    (banner ads, event ads, job posts, AI credit packs). These are
 *    ALWAYS charged — even during the growth period — EXCEPT for
 *    founders/admins, legacy founding members, and businesses with an
 *    active admin comp. NOT tied to NO_CHARGE_MODE.
 *
 *  - `shouldBypassAiCredits(user, biz)` — 4-prong rule (= founder/admin
 *    plus legacy `business.isFoundingMember === true`) used by AI feature
 *    credit deduction AND the SMS Broadcast credit pool. The extra prong
 *    exists because `is_founding_member` was the ORIGINAL founder-detection
 *    flag; rows created via that path may not match by name/email but
 *    should still bypass.
 */

import { isCompActive } from "@shared/config/membership";

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
 * GROWTH-PERIOD MEMBERSHIP SWITCH — while true, the RECURRING membership
 * surfaces are free for everyone: membership tier signup AND additional
 * zip-code listings. Every such checkout is activated for free.
 *
 * Why this exists: during the customer/business acquisition phase we don't
 * want a recurring membership fee to be a barrier to signing up. Flip this to
 * `false` (and redeploy) to resume charging membership dues.
 *
 * SCOPE — this switch covers MEMBERSHIP DUES + ADDITIONAL-ZIP LISTINGS ONLY.
 * Discrete paid purchases (banner ads, event ads, job posts, AI credit packs)
 * are still charged via `shouldBypassCharges` (founders/admins, founding
 * members, and active comps remain exempt there).
 *
 * IMPORTANT: this never grants unlimited AI credits — `shouldBypassAiCredits`
 * stays metered (only founders/admins/legacy founding-members get ∞) so the
 * platform's own OpenAI / SMS usage cost stays bounded.
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
 * Membership-side bypass — for the RECURRING membership surfaces (membership
 * tier checkout + additional-zip listings). FREE for everyone while
 * NO_CHARGE_MODE is on; otherwise only founders/admins.
 *
 * Defensive against null/undefined inputs.
 */
export function shouldBypassMembershipCharges(
  user: { accountType?: string | null; email?: string | null } | null | undefined,
  biz: { name?: string | null } | null | undefined,
): boolean {
  if (NO_CHARGE_MODE) return true;
  return isFounderOrAdmin(user, biz);
}

/**
 * Discrete-purchase bypass — for one-off / per-item paid surfaces (banner
 * ads, event ads, job posts, AI credit packs). These are ALWAYS charged, even
 * during the growth period, EXCEPT for:
 *   1-3. founders/admins (isFounderOrAdmin)
 *   4. legacy founding members (business.isFoundingMember === true)
 *   5. businesses with an ACTIVE admin comp (isCompActive)
 *
 * NOT tied to NO_CHARGE_MODE — growth mode only waives membership dues, not
 * discrete purchases. Defensive against null/undefined inputs.
 */
export function shouldBypassCharges(
  user: { accountType?: string | null; email?: string | null } | null | undefined,
  biz:
    | {
        name?: string | null;
        isFoundingMember?: boolean | null;
        isCompedMembership?: boolean | null;
        compedMembershipExpiresAt?: Date | string | null;
      }
    | null
    | undefined,
): boolean {
  if (isFounderOrAdmin(user, biz)) return true;
  if (biz?.isFoundingMember === true) return true;
  if (biz && isCompActive(biz)) return true;
  return false;
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
