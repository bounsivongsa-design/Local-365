---
name: NO_CHARGE_MODE growth switch
description: Global "charge nobody" flag, why AI/SMS credits are deliberately decoupled from it, and the founding-member side effect it can trigger.
---

# NO_CHARGE_MODE — global "charge nobody" switch

`NO_CHARGE_MODE` (in `server/lib/founderRules.ts`) is a single boolean that, while
true, makes the platform charge **nobody** real money on any Stripe surface
(membership, ads, jobs, event ads, additional-zip). To resume billing later: flip
it to `false` and redeploy. It is the central growth-mode kill switch.

## How it is wired
- `shouldBypassCharges = NO_CHARGE_MODE || isFounderOrAdmin(user, biz)`. Every paid
  surface already gates on `shouldBypassCharges`, so flipping the flag zeroes them
  all at once.
- `isFounderOrAdmin(user, biz)` is the durable 3-prong founder/admin rule (founder
  email, founder business name, admin accountType), extracted so it can be reused
  independently of the no-charge flag.

## CRITICAL: AI/SMS credits are NOT bypassed by NO_CHARGE_MODE
`shouldBypassAiCredits` is deliberately decoupled — it calls
`isFounderOrAdmin || isFoundingMember`, NEVER `NO_CHARGE_MODE`.
**Why:** AI (OpenAI) and SMS (Twilio) have real per-call vendor cost. If no-charge
mode handed everyone unlimited AI credits, our metered vendor bill would be
unbounded. Ordinary members must keep their metered free allotment even while
nobody is charged money. Keep these two concepts separate forever.

## Trap: the founding-member → unlimited-AI leak
`processMembershipActivation` (server/referrals.ts) assigns a founding-member
number for ANY paid-tier activation, which sets `isFoundingMember = true`. Because
`shouldBypassAiCredits` includes the legacy `isFoundingMember` flag, a founding
member silently gets unlimited AI. Under NO_CHARGE_MODE every signup flows through
the free membership-bypass branch, so calling that hook for ordinary users would
turn free signups into founding members → unlimited AI → blows the cost guardrail.
**Rule:** in the free membership-bypass branch (`server/stripe.ts`), only run
`processMembershipActivation` when `isFounderOrAdmin` is true. Free, non-founder
signups must never get a founding number. (The additional-zip free path already
follows this — it inserts children with `isFoundingMember=false`.)

## Other charge surface to remember
The AI credit-pack purchase route (`POST /api/ai/credit-packs/checkout` in
server/aiFeatures.ts) is NOT gated by `shouldBypassCharges` — it has its own guard.
It must check `NO_CHARGE_MODE` explicitly and refuse to sell packs while on.

## Tests are mode-aware
`server/__tests__/shouldBypassCharges.test.ts` and `startAddZipCheckout.test.ts`
branch on `NO_CHARGE_MODE` so the suite stays green both now and when billing
resumes. When you flip the flag, no test edits should be needed.
