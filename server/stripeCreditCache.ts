/**
 * Tiny in-process cache for Stripe customer-balance lookups used by the
 * dashboard's "Pending credit" widget.
 *
 * Why: the Refer & Earn card on the owner dashboard previously hit the
 * Stripe API on every page load to read `customer.balance`. Owners who
 * refresh frequently were eating Stripe rate-limit budget and adding
 * round-trip latency for a value that only changes when:
 *   1. We credit them via `processReferralOnFirstPaidInvoice`, or
 *   2. Stripe consumes the credit on their next paid invoice.
 *
 * Both paths invalidate the cache explicitly. A short TTL (5 min) is a
 * safety net so any out-of-band balance change (manual Stripe dashboard
 * adjustment, etc.) self-heals quickly.
 *
 * In-process Map is sufficient: this app runs on a single instance and
 * the cache value is cheap to recompute on a miss. If we ever scale to
 * multiple workers each instance will independently fetch on first hit
 * after invalidation, which is acceptable.
 */
import type Stripe from "stripe";

const TTL_MS = 5 * 60 * 1000;

interface CacheEntry {
  pendingCreditCents: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getPendingCreditCents(
  stripeCustomerId: string,
  stripe: Stripe,
): Promise<number> {
  const now = Date.now();
  const hit = cache.get(stripeCustomerId);
  if (hit && hit.expiresAt > now) {
    return hit.pendingCreditCents;
  }

  let pendingCreditCents = 0;
  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    if (!customer.deleted) {
      const balance = customer.balance ?? 0;
      if (balance < 0) pendingCreditCents = -balance;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[referrals] could not fetch Stripe balance for ${stripeCustomerId}:`,
      message,
    );
    // Cache 0 briefly so a degraded Stripe call doesn't get hammered.
    cache.set(stripeCustomerId, {
      pendingCreditCents: 0,
      expiresAt: now + 30 * 1000,
    });
    return 0;
  }

  cache.set(stripeCustomerId, {
    pendingCreditCents,
    expiresAt: now + TTL_MS,
  });
  return pendingCreditCents;
}

/**
 * Drop any cached balance for this customer. Call after we mutate their
 * Stripe balance (referral credit issued) or know Stripe has consumed
 * it (invoice.payment_succeeded).
 */
export function invalidateStripeCreditCache(stripeCustomerId: string): void {
  cache.delete(stripeCustomerId);
}
