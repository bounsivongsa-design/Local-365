/**
 * One-shot backfill for `businesses.last_known_pending_credit_cents`.
 *
 * For every business with a `stripeCustomerId`, fetches the customer's
 * current Stripe credit balance and writes it to the persistent column
 * used by the dashboard's "Pending credit" tile. After this runs, the
 * Stripe-outage safety net works for every owner from day one — not
 * just those who happen to load the dashboard while Stripe is healthy.
 *
 * Behaviour:
 *   - Skips rows where the Stripe customer is missing or deleted.
 *   - Honours Stripe rate limits via small per-request pacing and a
 *     bounded retry-with-backoff on 429 / network errors.
 *   - Logs a final summary of updated / skipped / errored rows.
 *
 * Run: `npx tsx scripts/backfillLastKnownPendingCredit.ts`
 *      (add `--dry-run` to log without writing).
 */
import Stripe from "stripe";
import { db } from "../server/db";
import { businesses } from "../shared/schema";
import { eq, isNotNull } from "drizzle-orm";

const STRIPE_KEY = process.env.Stripeintegration || process.env.STRIPE_SECRET_KEY;
if (!STRIPE_KEY) {
  console.error("Missing Stripe API key (Stripeintegration / STRIPE_SECRET_KEY)");
  process.exit(1);
}

const stripe = new Stripe(STRIPE_KEY, {
  apiVersion: "2025-02-24.acacia" as Stripe.LatestApiVersion,
});

const DRY_RUN = process.argv.includes("--dry-run");
const PER_REQUEST_DELAY_MS = 60; // ~16 req/s, well under Stripe's 25 rps live cap
const MAX_RETRIES = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchCustomerWithRetry(
  customerId: string,
): Promise<Stripe.Customer | Stripe.DeletedCustomer | null> {
  let attempt = 0;
  while (true) {
    try {
      return await stripe.customers.retrieve(customerId);
    } catch (err: any) {
      const code = err?.code;
      const status = err?.statusCode;
      if (status === 404 || code === "resource_missing") {
        return null;
      }
      const retryable = status === 429 || status === 503 || code === "rate_limit" ||
        code === "lock_timeout" || code === "ETIMEDOUT" || code === "ECONNRESET";
      if (!retryable || attempt >= MAX_RETRIES) {
        throw err;
      }
      const backoffMs = Math.min(8000, 250 * 2 ** attempt);
      console.warn(
        `[backfill] retryable error for ${customerId} (attempt ${attempt + 1}): ${err?.message}; sleeping ${backoffMs}ms`,
      );
      await sleep(backoffMs);
      attempt++;
    }
  }
}

async function main(): Promise<void> {
  console.log(
    `[backfill] starting${DRY_RUN ? " (dry run)" : ""} — last_known_pending_credit_cents`,
  );

  const rows = await db
    .select({
      id: businesses.id,
      stripeCustomerId: businesses.stripeCustomerId,
      existing: businesses.lastKnownPendingCreditCents,
    })
    .from(businesses)
    .where(isNotNull(businesses.stripeCustomerId));

  console.log(`[backfill] found ${rows.length} businesses with a Stripe customer`);

  let updated = 0;
  let unchanged = 0;
  let skippedDeleted = 0;
  let skippedMissing = 0;
  let errored = 0;

  for (const row of rows) {
    const customerId = row.stripeCustomerId!;
    try {
      const customer = await fetchCustomerWithRetry(customerId);
      if (!customer) {
        skippedMissing++;
        console.log(`[backfill] biz ${row.id}: customer ${customerId} not found, skipping`);
        await sleep(PER_REQUEST_DELAY_MS);
        continue;
      }
      if ((customer as Stripe.DeletedCustomer).deleted) {
        skippedDeleted++;
        console.log(`[backfill] biz ${row.id}: customer ${customerId} deleted, skipping`);
        await sleep(PER_REQUEST_DELAY_MS);
        continue;
      }
      const balance = (customer as Stripe.Customer).balance ?? 0;
      const pendingCreditCents = balance < 0 ? -balance : 0;

      if (row.existing === pendingCreditCents) {
        unchanged++;
      } else {
        if (!DRY_RUN) {
          await db
            .update(businesses)
            .set({ lastKnownPendingCreditCents: pendingCreditCents })
            .where(eq(businesses.id, row.id));
        }
        updated++;
        console.log(
          `[backfill] biz ${row.id}: ${row.existing ?? "NULL"} -> ${pendingCreditCents} cents${DRY_RUN ? " (dry run)" : ""}`,
        );
      }
    } catch (err: any) {
      errored++;
      console.error(
        `[backfill] biz ${row.id} (${customerId}) errored:`,
        err?.message ?? err,
      );
    }
    await sleep(PER_REQUEST_DELAY_MS);
  }

  console.log("[backfill] done");
  console.log(
    `[backfill] summary: total=${rows.length} updated=${updated} unchanged=${unchanged} skippedMissing=${skippedMissing} skippedDeleted=${skippedDeleted} errored=${errored}${DRY_RUN ? " (dry run, no writes)" : ""}`,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[backfill] fatal:", err);
    process.exit(1);
  });
