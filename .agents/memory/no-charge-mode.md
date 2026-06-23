---
name: NO_CHARGE_MODE growth switch
description: Growth-mode billing policy — membership + add-zip are free for all; discrete purchases (ads/events/jobs/AI packs) stay charged except founders/admins/founding-members/active-comps. Why AI/SMS credits are decoupled.
---

# NO_CHARGE_MODE — growth-mode MEMBERSHIP switch (NOT a blanket "charge nobody")

`NO_CHARGE_MODE` (in `server/lib/founderRules.ts`) waives ONLY the recurring
**membership** surfaces — membership dues + additional-zip listings — for
everyone while true. Discrete purchases are still charged. To resume membership
billing: flip it to `false` and redeploy.

**Why this scope:** the policy was deliberately narrowed. An earlier version made
the flag a blanket "charge nobody on every Stripe surface." The owner then
clarified: membership dues + extra zip listings = free for all; AI credit packs,
banner ads, event ads, paid job posts = charged normally, EXCEPT founders/admins,
founding members, and active admin-comped businesses (those stay free).

## Two charge-bypass helpers (do not merge them)
- `shouldBypassMembershipCharges(user, biz) = NO_CHARGE_MODE || isFounderOrAdmin`
  — used by membership checkout (`server/stripe.ts`) + add-zip (`server/multiZip.ts`,
  imported there aliased as `shouldBypassChargesForOwner`).
- `shouldBypassCharges(user, biz) = isFounderOrAdmin || biz.isFoundingMember ||
  isCompActive(biz)` — used by DISCRETE purchases: jobs/ads/event-ads in
  `server/stripe.ts` and event-ad/ad-create/ad-patch in `server/routes.ts`. It is
  NOT tied to NO_CHARGE_MODE.
  - **Data requirement:** call sites must pass a biz carrying `isFoundingMember`,
    `isCompedMembership`, `compedMembershipExpiresAt`. The `server/stripe.ts` sites
    use full `db.select().from(businesses)` rows (fine). The `server/routes.ts`
    partial selects had to add `isFoundingMember` (comp fields were already there).
- `isFounderOrAdmin` is the durable 3-prong rule (founder email, founder business
  name, admin accountType), reusable independently of the flags.

## CRITICAL: AI/SMS credits are NOT bypassed by NO_CHARGE_MODE
`shouldBypassAiCredits = isFounderOrAdmin || isFoundingMember`, NEVER
`NO_CHARGE_MODE`. **Why:** AI (OpenAI) and SMS (Twilio) have real per-call vendor
cost; handing everyone unlimited credits would make the metered bill unbounded.
Ordinary members keep their metered free allotment even while membership is free.

## Trap: the founding-member → unlimited-AI leak
`processMembershipActivation` assigns a founding-member number for ANY paid-tier
activation (sets `isFoundingMember = true`), and founding members get unlimited AI
via `shouldBypassAiCredits`. Under NO_CHARGE_MODE every signup flows through the
free membership-bypass branch, so running that hook for ordinary users would turn
free signups into founding members → unlimited AI → blows the cost guardrail.
**Rule:** in the free membership-bypass branch (`server/stripe.ts`), only run
`processMembershipActivation` when `isFounderOrAdmin` is true.

## AI credit-pack purchase route
`POST /api/ai/credit-packs/checkout` (`server/aiFeatures.ts`) is a DISCRETE
purchase → charged normally. It is NOT gated by NO_CHARGE_MODE. Bypass tiers:
- Founders/founding members → refused via `auth.isFounder` (they already have
  unlimited AI; no pack needed).
- Everyone else, INCLUDING active admin-comped businesses → real Stripe checkout.
  **Comps are NOT exempt for AI packs.** A comp grants the Gold tier's set
  monthly AI allotment; usage beyond that is paid like any other member.
  (This differs from ads/event-ads/job-posts, where comps ARE free — AI is the
  exception because every extra credit is real metered OpenAI cost.)
**Why this is the AI-specific exception:** the owner first said "give comps free
packs too", then corrected to "they only get a set amount of AI creds, beyond
that they pay." So comp = free on ads/events/jobs, but comp = charged on AI packs.
`shouldBypassAiCredits` stays founders/founding-members only — comps remain
metered for ordinary AI usage AND pay for top-up packs.

## Tests are mode-aware
`server/__tests__/shouldBypassCharges.test.ts` and `startAddZipCheckout.test.ts`
branch on `NO_CHARGE_MODE` so the suite stays green now and when billing resumes.
The charges test covers both helpers plus the founding-member/active-comp/expired-comp
cases for discrete purchases.
