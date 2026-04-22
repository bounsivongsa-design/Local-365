/**
 * Refer-a-Business + Founding Member program.
 *
 * Two growth mechanics:
 *
 * 1. REFER-A-BUSINESS  Each business has a unique `referralCode`. A new
 *    business can paste it into their signup form. When the referred
 *    business activates ANY paid membership, both parties get +30 days
 *    of Gold added to their `goldTrialEndDate`. One referral per
 *    referred business, ever.
 *
 * 2. FOUNDING MEMBER  The first 100 businesses to ever activate a paid
 *    membership get a permanent founding badge with a number (1..100)
 *    and locked-in pricing. After #100 the door closes.
 *
 * Both rewards are delivered by `processMembershipActivation()`, which
 * is called from every code path that flips a business into a paid
 * tier. The function is idempotent: the founding flag is only set
 * once, and the referral row uses a unique (referredBusinessId)
 * constraint + status check to prevent double-rewards.
 */
import { db } from "./db";
import { businesses, referrals } from "@shared/schema";
import { and, eq, sql, isNull, inArray } from "drizzle-orm";
import { notifyReferralInvoiceCredit, notifyAdminReferralPayoutFailed } from "./email";
import { invalidateStripeCreditCache, recordIssuedReferralCredit } from "./stripeCreditCache";
import Stripe from "stripe";

const FOUNDING_MEMBER_LIMIT = 100;
const REFERRAL_REWARD_DAYS = 30; // legacy fallback if referrer has no Stripe customer

const PAID_TIERS = new Set(["basic", "standard", "premium"]);

// Tier price fallbacks (cents/month) when we can't read the real Stripe sub.
// Used only for founders / comped accounts that have no live subscription.
const TIER_PRICE_CENTS_FALLBACK: Record<string, number> = {
  basic: 2500,
  standard: 5000,
  premium: 10000,
};

/**
 * Convert a Stripe sub item's full billing-period unit_amount into the
 * monthly-equivalent amount in cents. We must reward exactly ONE month —
 * not one billing period — so an annual sub at $1,200/yr becomes a
 * $100 credit, a semiannual at $600/6mo becomes $100, etc.
 */
function monthlyEquivalentCents(item: Stripe.SubscriptionItem | undefined): number {
  const unit = item?.price?.unit_amount;
  const recurring = item?.price?.recurring;
  if (typeof unit !== "number" || unit <= 0 || !recurring) return 0;
  const intervalCount = recurring.interval_count || 1;
  const monthsPerInterval =
    recurring.interval === "year" ? 12 :
    recurring.interval === "month" ? 1 :
    recurring.interval === "week" ? 1 / 4 :
    recurring.interval === "day" ? 1 / 30 : 1;
  const totalMonths = intervalCount * monthsPerInterval;
  if (totalMonths <= 0) return unit;
  return Math.round(unit / totalMonths);
}

/** Generates a friendly referral code like "REF-XK4Q9P". */
export function generateReferralCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I confusion
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return `REF-${s}`;
}

/**
 * Generates a code that is unique within the businesses table.
 * Retries on the (extremely unlikely) collision.
 */
export async function generateUniqueReferralCode(): Promise<string> {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateReferralCode();
    const [existing] = await db
      .select({ id: businesses.id })
      .from(businesses)
      .where(eq(businesses.referralCode, code))
      .limit(1);
    if (!existing) return code;
  }
  // Fallback - timestamp suffix is effectively unique
  return `REF-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

/**
 * Called during business signup: if the new business pasted in a
 * referral code, validate it and create a `pending` referral row.
 * Returns true if the link was successfully created.
 *
 * Validation:
 *   - code must exist on some business
 *   - referrer != referred (no self-refer)
 *   - referredBusinessId not already in any referral row (unique col)
 */
export async function linkReferralOnSignup(
  newBusinessId: number,
  rawCode: string | null | undefined,
): Promise<{ linked: boolean; reason?: string; referrerBusinessId?: number }> {
  if (!rawCode) return { linked: false, reason: "no code" };
  const code = rawCode.trim().toUpperCase();
  if (!code) return { linked: false, reason: "empty code" };

  const [referrer] = await db
    .select({ id: businesses.id })
    .from(businesses)
    .where(eq(businesses.referralCode, code))
    .limit(1);
  if (!referrer) return { linked: false, reason: "code not found" };
  if (referrer.id === newBusinessId) return { linked: false, reason: "self referral" };

  try {
    await db.insert(referrals).values({
      referrerBusinessId: referrer.id,
      referredBusinessId: newBusinessId,
      code,
      status: "pending",
    });
    return { linked: true, referrerBusinessId: referrer.id };
  } catch (err: any) {
    if (err?.code === "23505") {
      return { linked: false, reason: "already referred" };
    }
    throw err;
  }
}

/**
 * Adds N days to a business's `goldTrialEndDate`. If the date is in
 * the future, we extend from there; otherwise we extend from now.
 * Also stamps `originalMembershipTier` if missing so that when the
 * Gold window expires the business reverts to the right tier.
 */
async function addGoldDays(
  tx: typeof db,
  businessId: number,
  days: number,
): Promise<void> {
  // Atomic SQL: extend gold_trial_end_date by N days from whichever is later
  // (now() or current end date). Eliminates read-modify-write races when two
  // activations touching the same referrer run concurrently.
  // Also captures original membership tier in the same statement if missing,
  // so the business reverts to the correct tier when the Gold window closes.
  await tx.execute(sql`
    UPDATE businesses
    SET gold_trial_end_date =
          GREATEST(COALESCE(gold_trial_end_date, NOW()), NOW())
          + (${days}::int || ' days')::interval,
        original_membership_tier = COALESCE(
          original_membership_tier,
          CASE WHEN membership_tier = 'premium' THEN NULL ELSE membership_tier END
        )
    WHERE id = ${businessId}
  `);
}

/**
 * Try to assign the next founding member number atomically. Uses a
 * single SQL statement so concurrent activations can't both grab #N.
 *
 * Returns the assigned number, or null if the business is already a
 * founding member or all 100 slots are filled.
 */
async function tryAssignFoundingNumber(
  tx: typeof db,
  businessId: number,
): Promise<number | null> {
  // Concurrent activations could both compute the same MAX()+1 and collide on
  // the unique founding_member_number constraint. We retry on 23505 so neither
  // attempt drops its referral reward — only the founding-number side races,
  // and a unique violation just means another activation grabbed our slot.
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      const result = await tx.execute(sql`
        WITH next_num AS (
          SELECT COALESCE(MAX(founding_member_number), 0) + 1 AS n
          FROM businesses
          WHERE founding_member_number IS NOT NULL
        )
        UPDATE businesses b
        SET is_founding_member = true,
            founding_member_number = (SELECT n FROM next_num)
        FROM next_num
        WHERE b.id = ${businessId}
          AND (b.is_founding_member IS NOT TRUE OR b.founding_member_number IS NULL)
          AND next_num.n <= ${FOUNDING_MEMBER_LIMIT}
        RETURNING b.founding_member_number;
      `);
      const rows = (result as any).rows ?? result;
      const row = Array.isArray(rows) ? rows[0] : undefined;
      return row?.founding_member_number ?? null;
    } catch (err: any) {
      if (err?.code === "23505") continue; // unique race - retry
      throw err;
    }
  }
  return null;
}

/**
 * Idempotent post-activation hook. Call this after ANY code path that
 * flips a business into a paid tier. Safe to call multiple times.
 *
 * Side effects:
 *   - Assigns founding member number if eligible (first 100 paid)
 *
 * NOTE: Referral payout no longer happens here. It moved to
 * `processReferralOnFirstPaidInvoice`, which fires from the
 * `invoice.payment_succeeded` webhook so we only reward when actual
 * money has been collected (i.e. the trial converted to a real paid
 * month). The `referralRewarded`/`referrerBusinessId` fields on the
 * return value are kept for callers' backwards compat and are now
 * always false/null.
 */
export async function processMembershipActivation(
  businessId: number,
): Promise<{
  foundingNumber: number | null;
  referralRewarded: boolean;
  referrerBusinessId: number | null;
}> {
  const [biz] = await db
    .select({
      id: businesses.id,
      membershipTier: businesses.membershipTier,
      isFoundingMember: businesses.isFoundingMember,
    })
    .from(businesses)
    .where(eq(businesses.id, businessId));

  if (!biz) {
    return { foundingNumber: null, referralRewarded: false, referrerBusinessId: null };
  }
  // Only react to paid memberships
  if (!biz.membershipTier || !PAID_TIERS.has(biz.membershipTier)) {
    return { foundingNumber: null, referralRewarded: false, referrerBusinessId: null };
  }

  let foundingNumber: number | null = null;
  let referralRewarded = false;
  let referrerBusinessId: number | null = null;
  let rewardedDays: number = REFERRAL_REWARD_DAYS;

  // Founding member assignment only. Referral payout has moved to
  // `processReferralOnFirstPaidInvoice`, which fires when the referee
  // actually pays their first invoice (i.e. trial converts to paid).
  if (!biz.isFoundingMember) {
    foundingNumber = await tryAssignFoundingNumber(db, businessId);
  }

  if (foundingNumber) {
    console.log(`[referrals] biz=${businessId} foundingNumber=${foundingNumber}`);
  }

  // Suppress unused-var warnings; kept in return shape for backwards compat.
  void rewardedDays;
  void addGoldDays;
  return { foundingNumber, referralRewarded, referrerBusinessId };
}

/**
 * Fires from the Stripe `invoice.payment_succeeded` webhook. When the
 * referee completes their first real paid charge (i.e. trial converted
 * to paid), credit the referrer with one month of their current
 * membership price as a Stripe customer-balance adjustment that will
 * apply to their next invoice.
 *
 * Idempotent on two layers:
 *   1. Atomic UPDATE … WHERE status='pending' guarantees only one
 *      caller transitions the referral row.
 *   2. The Stripe balance transaction includes the referral id in
 *      metadata; if we ever retry, the row is already 'rewarded'.
 *
 * Intentionally tolerant: if the referrer has no Stripe customer
 * (founder / comp account), we still flip the row to 'rewarded' and
 * fall back to extending their Gold trial by 30 days so the referee's
 * goodwill isn't lost.
 */
export async function processReferralOnFirstPaidInvoice(args: {
  referredBusinessId: number;
  invoice: Stripe.Invoice;
  stripe: Stripe;
}): Promise<{ rewarded: boolean; reason?: string; creditCents?: number }> {
  const { referredBusinessId, invoice, stripe } = args;

  // Only count real money. Trial-conversion invoices have amount_paid > 0;
  // the synthetic $0 invoice Stripe emits when a trial subscription is
  // first created (billing_reason='subscription_create' with amount 0)
  // does NOT trigger payout.
  if ((invoice.amount_paid ?? 0) <= 0) {
    return { rewarded: false, reason: "zero amount invoice" };
  }
  if (invoice.status !== "paid") {
    return { rewarded: false, reason: `invoice not paid (${invoice.status})` };
  }

  // Look up the pending referral for this referee.
  const [pending] = await db
    .select()
    .from(referrals)
    .where(
      and(
        eq(referrals.referredBusinessId, referredBusinessId),
        eq(referrals.status, "pending"),
      ),
    );
  if (!pending) {
    return { rewarded: false, reason: "no pending referral" };
  }

  // Atomically transition pending → processing so concurrent webhooks
  // can't both attempt the credit. If we crash before finalizing, a
  // safety net (`requeueStuckProcessingReferrals`) flips the row back
  // to 'pending' so the next webhook delivery can retry.
  const [claimed] = await db
    .update(referrals)
    .set({ status: "processing" })
    .where(and(eq(referrals.id, pending.id), eq(referrals.status, "pending")))
    .returning({ id: referrals.id });
  if (!claimed) {
    return { rewarded: false, reason: "lost race to concurrent caller" };
  }

  type Party = {
    id: number;
    name: string | null;
    email: string | null;
    membershipTier: string | null;
    stripeCustomerId: string | null;
    stripeSubscriptionId: string | null;
  };
  let referrer: Party | undefined;
  let referred: Party | undefined;

  try {
    const parties = await db
      .select({
        id: businesses.id,
        name: businesses.name,
        email: businesses.email,
        membershipTier: businesses.membershipTier,
        stripeCustomerId: businesses.stripeCustomerId,
        stripeSubscriptionId: businesses.stripeSubscriptionId,
      })
      .from(businesses)
      .where(inArray(businesses.id, [pending.referrerBusinessId, referredBusinessId]));

    referrer = parties.find((p) => p.id === pending.referrerBusinessId);
    referred = parties.find((p) => p.id === referredBusinessId);
    if (!referrer || !referred) {
      throw new Error(`missing party row(s) referrer=${pending.referrerBusinessId} referred=${referredBusinessId}`);
    }

    // Defense in depth: even though the webhook gate filters by
    // `businesses.stripeSubscriptionId`, double-check here so any
    // future caller of this function can't accidentally reward off a
    // job-listing or additional-zip invoice. The referee's MEMBERSHIP
    // subscription id must match the invoice's subscription id.
    const invoiceSubId = (invoice.subscription as string | null) ?? null;
    if (!invoiceSubId || !referred.stripeSubscriptionId || referred.stripeSubscriptionId !== invoiceSubId) {
      throw new Error(
        `invoice subscription ${invoiceSubId} is not the membership sub for biz ${referredBusinessId} (membership=${referred.stripeSubscriptionId})`,
      );
    }

    // One-month credit calculation. Always normalize to monthly equivalent
    // so an annual sub doesn't over-credit by 12x.
    let creditCents = 0;
    if (referrer.stripeSubscriptionId) {
      try {
        const sub = await stripe.subscriptions.retrieve(referrer.stripeSubscriptionId);
        creditCents = monthlyEquivalentCents(sub.items?.data?.[0]);
      } catch (err: any) {
        console.warn(`[referrals] could not fetch referrer sub ${referrer.stripeSubscriptionId}:`, err?.message);
      }
    }
    if (!creditCents) {
      creditCents = TIER_PRICE_CENTS_FALLBACK[referrer.membershipTier ?? ""] ?? 5000;
    }

    // Whether we actually issued a Stripe credit. Only true if we hit the
    // stripe.customers.createBalanceTransaction path below; the Gold-days
    // fallback for founder/comp accounts is NOT a dollar credit and must
    // leave creditAmountCents null so reporting stays honest.
    let stripeCreditIssued = false;

    if (referrer.stripeCustomerId) {
      // Apply the Stripe credit BEFORE finalizing the row. Idempotency
      // key keyed on referralId means safe under retry — if we crashed
      // after the API call but before the DB write, a future call with
      // the same key returns the original transaction instead of
      // double-crediting. Failure here throws and falls into the catch
      // below which flips the row back to 'pending' for retry.
      await stripe.customers.createBalanceTransaction(
        referrer.stripeCustomerId,
        {
          amount: -creditCents,
          currency: "usd",
          description: `Referral reward: ${referred.name} (referral #${pending.id})`,
          metadata: {
            referralId: String(pending.id),
            referredBusinessId: String(referredBusinessId),
            referrerBusinessId: String(pending.referrerBusinessId),
            source: "locallist365_referral",
          },
        },
        { idempotencyKey: `referral-credit-${pending.id}` },
      );
      stripeCreditIssued = true;
      console.log(`[referrals] credited $${(creditCents / 100).toFixed(2)} to customer ${referrer.stripeCustomerId} for referral ${pending.id}`);
      // Drop the cached pending-credit AND bump the persisted last-known
      // value so the next dashboard load reflects the new balance even if
      // Stripe is unreachable at that moment.
      await recordIssuedReferralCredit(referrer.stripeCustomerId, creditCents);
    } else {
      // Founder / comp account fallback: extend Gold trial by 30 days.
      // This DB write is itself idempotent at the day-extension level via
      // GREATEST(...), so a retry would extend twice. We accept that risk
      // because (a) only founders/comps hit this branch, (b) the row
      // flips to 'rewarded' immediately below so retries shouldn't
      // happen.
      await addGoldDays(db, referrer.id, REFERRAL_REWARD_DAYS);
      console.log(`[referrals] no stripeCustomerId on referrer ${referrer.id}; granted +${REFERRAL_REWARD_DAYS} Gold days instead`);
    }

    // Credit succeeded — finalize the row. Persist the exact cents we just
    // issued so the admin UI can show the real number even if the referrer
    // later changes tiers. For the Gold-days fallback (no Stripe customer)
    // we leave creditAmountCents null since no dollar credit was issued.
    await db
      .update(referrals)
      .set({
        status: "rewarded",
        rewardedAt: new Date(),
        creditAmountCents: stripeCreditIssued ? creditCents : null,
      })
      .where(eq(referrals.id, pending.id));

    // Best-effort email — failures must not undo the reward.
    try {
      await notifyReferralInvoiceCredit({
        referrerEmail: referrer.email,
        referrerBusinessName: referrer.name,
        referredBusinessName: referred.name,
        creditAmountCents: creditCents,
      });
    } catch (err) {
      console.error("[referrals] reward email send failed (non-fatal):", err);
    }

    return { rewarded: true, creditCents };
  } catch (err: any) {
    // Roll the row back to pending so the next webhook delivery (or
    // a manual replay) can retry.
    await db
      .update(referrals)
      .set({ status: "pending" })
      .where(and(eq(referrals.id, pending.id), eq(referrals.status, "processing")));
    console.error(`[referrals] reward FAILED for referral ${pending.id}, rolled back to pending:`, err?.message ?? err);

    // Best-effort admin alert so failed payouts don't sit unnoticed.
    // Must never throw — email failures cannot undo the rollback above.
    try {
      await notifyAdminReferralPayoutFailed({
        referralId: pending.id,
        referrerBusinessId: pending.referrerBusinessId,
        referrerBusinessName: referrer?.name ?? null,
        referrerEmail: referrer?.email ?? null,
        referredBusinessId,
        referredBusinessName: referred?.name ?? null,
        referredEmail: referred?.email ?? null,
        invoiceId: invoice.id ?? null,
        errorMessage: err?.message ?? String(err ?? "unknown error"),
      });
    } catch (emailErr) {
      console.error("[referrals] admin payout-failed email send failed (non-fatal):", emailErr);
    }

    return { rewarded: false, reason: `error: ${err?.message ?? "unknown"}` };
  }
}

/**
 * Safety net for rows stuck in 'processing' (e.g. server crashed
 * mid-webhook before finalize). Designed to be called ONCE at app
 * boot: any row still in 'processing' at startup is necessarily a
 * leftover from a previous instance — the in-process flow always
 * resolves the row to 'rewarded' or back to 'pending' before the
 * function returns. Flips such rows back to 'pending' so the next
 * webhook delivery (or an admin replay) can complete the reward.
 *
 * Do NOT call this from a periodic timer in the same instance — it
 * would race with concurrent in-flight processors. Boot-only.
 */
export async function requeueStuckProcessingReferrals(): Promise<number> {
  const result = await db.execute(sql`
    UPDATE referrals
    SET status = 'pending'
    WHERE status = 'processing'
    RETURNING id
  `);
  const rows = (result as any).rows ?? result;
  const count = Array.isArray(rows) ? rows.length : 0;
  if (count > 0) {
    console.log(`[referrals] requeued ${count} stuck 'processing' referral row(s) on boot`);
  }
  return count;
}

/**
 * Lazy-ensures a business has a referralCode. Used by API endpoints
 * that surface the code in the dashboard so even pre-feature businesses
 * have one ready to share. The migration backfilled all existing rows
 * but this is a safety net for any edge case.
 */
export async function ensureReferralCode(businessId: number): Promise<string | null> {
  const [biz] = await db
    .select({ referralCode: businesses.referralCode })
    .from(businesses)
    .where(eq(businesses.id, businessId));
  if (!biz) return null;
  if (biz.referralCode) return biz.referralCode;

  const code = await generateUniqueReferralCode();
  await db
    .update(businesses)
    .set({ referralCode: code })
    .where(and(eq(businesses.id, businessId), isNull(businesses.referralCode)));
  return code;
}
