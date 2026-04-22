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
import { notifyReferralInvoiceCredit } from "./email";
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
 *   - Rewards a pending referral (extends both parties +30d Gold)
 *
 * Returns a small report object for logging.
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

  // Atomic transition — only one caller wins.
  const [claimed] = await db
    .update(referrals)
    .set({ status: "rewarded", rewardedAt: new Date() })
    .where(and(eq(referrals.id, pending.id), eq(referrals.status, "pending")))
    .returning({ id: referrals.id });
  if (!claimed) {
    return { rewarded: false, reason: "lost race to concurrent caller" };
  }

  // Look up both parties (we already won the row, so even if any of
  // this fails the referral stays marked rewarded — operator can
  // manually retry crediting via Stripe dashboard).
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

  const referrer = parties.find((p) => p.id === pending.referrerBusinessId);
  const referred = parties.find((p) => p.id === referredBusinessId);
  if (!referrer || !referred) {
    console.warn(`[referrals] reward: missing party row(s) referrer=${pending.referrerBusinessId} referred=${referredBusinessId}`);
    return { rewarded: true, reason: "marked rewarded but party row(s) missing" };
  }

  // Determine credit amount: prefer the referrer's actual current
  // monthly subscription price; fall back to tier price table.
  let creditCents = 0;
  if (referrer.stripeSubscriptionId) {
    try {
      const sub = await stripe.subscriptions.retrieve(referrer.stripeSubscriptionId);
      const item = sub.items?.data?.[0];
      const unit = item?.price?.unit_amount;
      if (typeof unit === "number" && unit > 0) creditCents = unit;
    } catch (err: any) {
      console.warn(`[referrals] could not fetch referrer sub ${referrer.stripeSubscriptionId}:`, err?.message);
    }
  }
  if (!creditCents) {
    creditCents = TIER_PRICE_CENTS_FALLBACK[referrer.membershipTier ?? ""] ?? 5000;
  }

  if (referrer.stripeCustomerId) {
    try {
      // Negative amount = credit applied to NEXT invoice automatically.
      await stripe.customers.createBalanceTransaction(referrer.stripeCustomerId, {
        amount: -creditCents,
        currency: "usd",
        description: `Referral reward: ${referred.name} (referral #${pending.id})`,
        metadata: {
          referralId: String(pending.id),
          referredBusinessId: String(referredBusinessId),
          referrerBusinessId: String(pending.referrerBusinessId),
          source: "locallist365_referral",
        },
      });
      console.log(`[referrals] credited $${(creditCents / 100).toFixed(2)} to customer ${referrer.stripeCustomerId} for referral ${pending.id}`);
    } catch (err: any) {
      console.error(`[referrals] Stripe credit failed for referral ${pending.id}:`, err?.message);
    }
  } else {
    // Founder / comp account fallback: extend Gold trial by 30 days.
    await addGoldDays(db, referrer.id, REFERRAL_REWARD_DAYS);
    console.log(`[referrals] no stripeCustomerId on referrer ${referrer.id}; granted +${REFERRAL_REWARD_DAYS} Gold days instead`);
  }

  // Best-effort email — failures must not roll back the reward.
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
