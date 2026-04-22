/**
 * Pending-credit lookups for the owner dashboard's "Refer & Earn" card.
 *
 * Two layers, in order of priority on a read:
 *   1. In-process Map cache (TTL 5 min) — avoids hammering Stripe when an
 *      owner refreshes the dashboard repeatedly.
 *   2. Persistent column `businesses.last_known_pending_credit_cents` —
 *      survives server restarts AND Stripe outages so we can keep showing
 *      the owner their real credit dollar value instead of a misleading $0.
 *
 * Write path (keeps both layers in sync):
 *   - Successful Stripe `customers.retrieve`: write the fresh value to
 *     both the cache and the DB column.
 *   - Failed Stripe call: do NOT overwrite the DB; fall back to the
 *     persisted last-known value. Briefly cache that fallback (30 s) so a
 *     degraded Stripe doesn't get hammered on every dashboard refresh.
 *   - Referral payout (`processReferralOnFirstPaidInvoice`): increments
 *     the DB column by the credited cents and invalidates the in-process
 *     cache, so the next dashboard load reflects the new balance even if
 *     Stripe is unreachable at that moment.
 *   - Invoice payment_succeeded webhook: any paid invoice may have
 *     consumed credit, so the cache is invalidated and we'll re-read on
 *     the next dashboard hit.
 *
 * Both cache + DB writes are best-effort: if the DB write fails we still
 * return the value from the live Stripe call.
 */
import type Stripe from "stripe";
import { db } from "./db";
import { businesses } from "@shared/schema";
import { eq, sql } from "drizzle-orm";

const TTL_MS = 5 * 60 * 1000;
const FAILURE_TTL_MS = 30 * 1000;

interface CacheEntry {
  pendingCreditCents: number;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

async function readPersistedCredit(stripeCustomerId: string): Promise<number | null> {
  try {
    const [row] = await db
      .select({ cents: businesses.lastKnownPendingCreditCents })
      .from(businesses)
      .where(eq(businesses.stripeCustomerId, stripeCustomerId))
      .limit(1);
    return row?.cents ?? null;
  } catch (err) {
    console.warn(
      `[referrals] could not read persisted credit for ${stripeCustomerId}:`,
      err instanceof Error ? err.message : String(err),
    );
    return null;
  }
}

async function writePersistedCredit(
  stripeCustomerId: string,
  cents: number,
): Promise<void> {
  try {
    await db
      .update(businesses)
      .set({ lastKnownPendingCreditCents: cents })
      .where(eq(businesses.stripeCustomerId, stripeCustomerId));
  } catch (err) {
    console.warn(
      `[referrals] could not persist credit for ${stripeCustomerId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

export async function getPendingCreditCents(
  stripeCustomerId: string,
  stripe: Stripe,
): Promise<number> {
  const now = Date.now();
  const hit = cache.get(stripeCustomerId);
  if (hit && hit.expiresAt > now) {
    return hit.pendingCreditCents;
  }

  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    let pendingCreditCents = 0;
    if (!customer.deleted) {
      const balance = customer.balance ?? 0;
      if (balance < 0) pendingCreditCents = -balance;
    }
    cache.set(stripeCustomerId, {
      pendingCreditCents,
      expiresAt: now + TTL_MS,
    });
    // Persist asynchronously — never block the dashboard on this write.
    void writePersistedCredit(stripeCustomerId, pendingCreditCents);
    return pendingCreditCents;
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(
      `[referrals] could not fetch Stripe balance for ${stripeCustomerId}:`,
      message,
    );
    // Stripe is unreachable / degraded. Fall back to the last value we
    // persisted so the owner sees their real credit instead of $0.
    const persisted = await readPersistedCredit(stripeCustomerId);
    const fallback = persisted ?? 0;
    cache.set(stripeCustomerId, {
      pendingCreditCents: fallback,
      expiresAt: now + FAILURE_TTL_MS,
    });
    return fallback;
  }
}

/**
 * Drop any cached balance for this customer. Call after we mutate their
 * Stripe balance (referral credit issued) or know Stripe has consumed
 * it (invoice.payment_succeeded). Does NOT touch the persisted DB value
 * — that is updated explicitly by the writer (see
 * `recordIssuedReferralCredit`) or refreshed on the next successful
 * Stripe read.
 */
export function invalidateStripeCreditCache(stripeCustomerId: string): void {
  cache.delete(stripeCustomerId);
}

/**
 * Called immediately after we successfully issue a referral credit to
 * a customer. Increments the persisted last-known credit by the credited
 * amount so an owner who loads the dashboard during a Stripe outage
 * still sees the new (larger) pending balance, and drops the in-process
 * cache so the next live read refreshes it.
 */
export async function recordIssuedReferralCredit(
  stripeCustomerId: string,
  addedCents: number,
): Promise<void> {
  invalidateStripeCreditCache(stripeCustomerId);
  if (addedCents <= 0) return;
  try {
    // Atomic increment so two concurrent payouts to the same customer
    // can't lose an update via read-modify-write.
    await db.execute(sql`
      UPDATE businesses
      SET last_known_pending_credit_cents =
            COALESCE(last_known_pending_credit_cents, 0) + ${addedCents}
      WHERE stripe_customer_id = ${stripeCustomerId}
    `);
  } catch (err) {
    console.warn(
      `[referrals] could not bump persisted credit for ${stripeCustomerId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}

/**
 * Re-read the customer's current credit balance from Stripe and persist
 * it. Called from the `invoice.payment_succeeded` webhook so any credit
 * Stripe just consumed against this invoice is reflected in the
 * persisted last-known value (otherwise an outage right after the
 * webhook would let the dashboard overstate the balance until the next
 * successful live read).
 *
 * Best-effort: if Stripe is unreachable we leave the persisted value
 * alone — overstating briefly is a smaller harm than blanking it out
 * to 0 on a transient API failure.
 */
export async function refreshPersistedCreditFromStripe(
  stripeCustomerId: string,
  stripe: Stripe,
): Promise<void> {
  invalidateStripeCreditCache(stripeCustomerId);
  try {
    const customer = await stripe.customers.retrieve(stripeCustomerId);
    let pendingCreditCents = 0;
    if (!customer.deleted) {
      const balance = customer.balance ?? 0;
      if (balance < 0) pendingCreditCents = -balance;
    }
    await writePersistedCredit(stripeCustomerId, pendingCreditCents);
  } catch (err) {
    console.warn(
      `[referrals] could not refresh persisted credit for ${stripeCustomerId}:`,
      err instanceof Error ? err.message : String(err),
    );
  }
}
