import pg from "pg";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error(
    "[realign-constraints] DATABASE_URL is not set; cannot realign the database.",
  );
  process.exit(1);
}

type RenameRule = {
  table: string;
  from: string;
  to: string;
};

const RENAMES: RenameRule[] = [
  {
    table: "businesses",
    from: "businesses_referral_code_key",
    to: "businesses_referral_code_unique",
  },
  {
    table: "businesses",
    from: "businesses_founding_member_number_key",
    to: "businesses_founding_member_number_unique",
  },
  {
    table: "referrals",
    from: "referrals_referred_business_id_key",
    to: "referrals_referred_business_id_unique",
  },
  {
    table: "newsletter_subscribers",
    from: "newsletter_subscribers_unsubscribe_token_key",
    to: "newsletter_subscribers_unsubscribe_token_unique",
  },
  {
    table: "review_requests",
    from: "review_requests_token_key",
    to: "review_requests_token_unique",
  },
];

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  try {
    const client = await pool.connect();
    try {
      const actions: string[] = [];

      const tableExists = async (name: string): Promise<boolean> => {
        const r = await client.query<{ exists: boolean }>(
          `SELECT to_regclass($1) IS NOT NULL AS exists`,
          [`public.${name}`],
        );
        return r.rows[0]?.exists ?? false;
      };

      const constraintExists = async (
        table: string,
        name: string,
      ): Promise<boolean> => {
        const r = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM pg_constraint
             WHERE conrelid = $1::regclass AND conname = $2
           ) AS exists`,
          [`public.${table}`, name],
        );
        return r.rows[0]?.exists ?? false;
      };

      const indexExists = async (name: string): Promise<boolean> => {
        const r = await client.query<{ exists: boolean }>(
          `SELECT EXISTS (
             SELECT 1 FROM pg_indexes
             WHERE schemaname = 'public' AND indexname = $1
           ) AS exists`,
          [name],
        );
        return r.rows[0]?.exists ?? false;
      };

      // 1) Rename legacy `<table>_<col>_key` constraints to drizzle's
      //    `<table>_<col>_unique` naming. If both already exist, drop the
      //    legacy one (it's a leftover duplicate).
      for (const rule of RENAMES) {
        if (!(await tableExists(rule.table))) continue;
        const fromExists = await constraintExists(rule.table, rule.from);
        const toExists = await constraintExists(rule.table, rule.to);

        if (fromExists && toExists) {
          await client.query(
            `ALTER TABLE ${rule.table} DROP CONSTRAINT ${rule.from}`,
          );
          actions.push(
            `dropped duplicate constraint ${rule.table}.${rule.from} (kept ${rule.to})`,
          );
        } else if (fromExists && !toExists) {
          await client.query(
            `ALTER TABLE ${rule.table} RENAME CONSTRAINT ${rule.from} TO ${rule.to}`,
          );
          actions.push(
            `renamed constraint ${rule.table}.${rule.from} -> ${rule.to}`,
          );
        }
      }

      // 2) `locations.slug` historically lived as a partial UNIQUE INDEX
      //    (`WHERE slug IS NOT NULL`) but `shared/schema.ts` declares it as
      //    `text("slug").unique()`, which drizzle-kit emits as a real
      //    UNIQUE CONSTRAINT. Reconcile by promoting the index to a
      //    constraint so push doesn't prompt to truncate the table.
      if (await tableExists("locations")) {
        const hasConstraint = await constraintExists(
          "locations",
          "locations_slug_unique",
        );
        const hasIndex = await indexExists("locations_slug_unique");

        if (!hasConstraint) {
          // Drop the partial index (if any) before adding the constraint;
          // Postgres would otherwise complain about the duplicate name.
          if (hasIndex) {
            await client.query(`DROP INDEX locations_slug_unique`);
            actions.push("dropped partial index locations_slug_unique");
          }
          // Guard against duplicate slugs that would block constraint creation.
          const dups = await client.query<{ slug: string; count: string }>(
            `SELECT slug, COUNT(*)::text AS count
               FROM locations
              WHERE slug IS NOT NULL
              GROUP BY slug
             HAVING COUNT(*) > 1`,
          );
          if (dups.rows.length > 0) {
            console.error(
              `[realign-constraints] Cannot add UNIQUE on locations.slug — duplicate slugs exist: ${dups.rows
                .map((r) => `${r.slug} (${r.count})`)
                .join(", ")}`,
            );
            process.exit(1);
          }
          await client.query(
            `ALTER TABLE locations ADD CONSTRAINT locations_slug_unique UNIQUE (slug)`,
          );
          actions.push(
            "added UNIQUE constraint locations_slug_unique on locations(slug)",
          );
        }
      }

      if (actions.length === 0) {
        console.log(
          "[realign-constraints] OK — no legacy constraint names found, nothing to do.",
        );
      } else {
        console.log("[realign-constraints] Applied:");
        for (const a of actions) console.log(`  - ${a}`);
      }
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error("[realign-constraints] Failed:", err);
  process.exit(1);
});
