import pg from "pg";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import * as schema from "../shared/schema";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  console.error(
    "[schema-drift] DATABASE_URL is not set. Cannot verify the test database schema.",
  );
  process.exit(1);
}

type ExpectedColumn = { table: string; column: string };

function collectExpectedColumns(): ExpectedColumn[] {
  const expected: ExpectedColumn[] = [];
  for (const value of Object.values(schema)) {
    if (!(value instanceof PgTable)) continue;
    const cfg = getTableConfig(value as PgTable);
    for (const col of cfg.columns) {
      expected.push({ table: cfg.name, column: col.name });
    }
  }
  return expected;
}

async function main() {
  const expected = collectExpectedColumns();
  const tables = Array.from(new Set(expected.map((e) => e.table))).sort();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  let actual: Map<string, Set<string>>;
  try {
    const res = await pool.query<{ table_name: string; column_name: string }>(
      `SELECT table_name, column_name
       FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [tables],
    );
    actual = new Map();
    for (const row of res.rows) {
      let set = actual.get(row.table_name);
      if (!set) {
        set = new Set();
        actual.set(row.table_name, set);
      }
      set.add(row.column_name);
    }
  } finally {
    await pool.end();
  }

  const missingTables: string[] = [];
  const missingColumns: ExpectedColumn[] = [];
  for (const table of tables) {
    const cols = actual.get(table);
    if (!cols || cols.size === 0) {
      missingTables.push(table);
      continue;
    }
    for (const { column } of expected.filter((e) => e.table === table)) {
      if (!cols.has(column)) {
        missingColumns.push({ table, column });
      }
    }
  }

  if (missingTables.length === 0 && missingColumns.length === 0) {
    console.log(
      `[schema-drift] OK — verified ${tables.length} tables / ${expected.length} columns against the database.`,
    );
    return;
  }

  console.error(
    "\n[schema-drift] Database schema is out of sync with shared/schema.ts.\n",
  );
  if (missingTables.length > 0) {
    console.error("Missing tables:");
    for (const t of missingTables) console.error(`  - ${t}`);
    console.error("");
  }
  if (missingColumns.length > 0) {
    console.error("Missing columns:");
    for (const { table, column } of missingColumns) {
      console.error(`  - ${table}.${column}`);
    }
    console.error("");
  }
  console.error(
    "Run `npm run db:push` (or `npm run db:push -- --force`) against the test database to apply the latest schema, then re-run the tests.",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("[schema-drift] Failed to verify database schema:", err);
  process.exit(1);
});
