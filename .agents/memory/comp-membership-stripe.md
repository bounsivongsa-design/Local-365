---
name: Comp membership must cancel the paid Stripe subscription
description: Granting an admin "free Gold" comp must cancel any live paid Stripe subscription, or the comped customer keeps getting billed.
---

# Comp membership ↔ Stripe billing

When an admin grants a comp ("free Gold") on a business, the comp logic must
**cancel the business's live paid Stripe subscription**. Flipping the comp DB
flags alone does NOT stop billing — Stripe keeps charging the saved card every
cycle, so a "free" customer still gets charged.

**Why:** A real customer (Back Bay Lawn Care) was charged in production after
being comped indefinitely, because `setBusinessCompMembership` only updated DB
columns and left their subscription live.

**How to apply:**
- Cancellation lives in `setBusinessCompMembership` (server/comp.ts) on grant
  (active=true): cancel `business.stripeSubscriptionId`, then clear the column
  ONLY on cancel success (don't orphan a still-billing sub). On Stripe failure,
  log loudly and keep the pointer for manual reconciliation; never roll back the
  comp grant.
- A comped business's effective tier comes from `isCompActive` /
  `getEffectiveTier` (returns "premium"), so the `customer.subscription.deleted`
  webhook setting `membership_tier='none'` is harmless — features stay on.
- `business.stripeSubscriptionId` always holds the MEMBERSHIP sub; additional-zip
  children share the parent's Stripe customer but hold no membership sub.
- Refunds are NOT done in-app — they must be issued from the live Stripe
  dashboard. Re-saving a comp after deploy will cancel a still-live sub.
- Self-healing sweep `reconcileCompedSubscriptions()` (server/comp.ts) runs at
  startup + hourly: for every ACTIVE comp (no expiry or future expiry) with a
  live membership sub pointer, it cancels the sub via the same shared helper
  the grant path uses (skips non-membership metadata.type, skips already-
  canceled, keeps pointer on Stripe failure for retry). Expired comps are
  skipped — their sub is a legit paid membership. This catches comps granted
  BEFORE the grant-time auto-cancel fix existed (the Back Bay double-charge).
