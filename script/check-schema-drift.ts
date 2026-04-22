import pg from "pg";
import { getTableConfig, PgDialect, PgTable } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import * as schema from "../shared/schema";

const { Pool } = pg;
const dialect = new PgDialect();

// Normalize a SQL predicate for comparison between drizzle's `.where(sql\`…\`)`
// declaration and Postgres's `pg_get_expr(indpred, indrelid)` output. Postgres
// decompiles the predicate with extra outer parentheses (e.g.
// `(grant_period IS NOT NULL)`) and may differ in whitespace/case. We
// lowercase, collapse whitespace, and peel off *only* balanced outer
// parentheses — interior parens are preserved so that precedence-sensitive
// predicates like `(a AND b) OR c` aren't collapsed to the same string as
// `a AND (b OR c)`. The drift message still prints both raw forms so the
// human can adjudicate edge cases.
function normalizePredicate(s: string | null | undefined): string {
  if (!s) return "";
  let out = s.toLowerCase().replace(/\s+/g, " ").trim();
  // Repeatedly strip a single balanced pair of outer parens, e.g.
  // "((a is not null))" -> "a is not null". A pair is "outer" only if
  // the matching close paren is the very last character.
  while (out.startsWith("(") && out.endsWith(")")) {
    let depth = 0;
    let matchedAtEnd = true;
    for (let i = 0; i < out.length; i++) {
      const ch = out[i];
      if (ch === "(") depth++;
      else if (ch === ")") {
        depth--;
        if (depth === 0 && i !== out.length - 1) {
          matchedAtEnd = false;
          break;
        }
      }
    }
    if (!matchedAtEnd || depth !== 0) break;
    out = out.slice(1, -1).trim();
  }
  return out.replace(/\s+/g, "");
}

if (!process.env.DATABASE_URL) {
  console.error(
    "[schema-drift] DATABASE_URL is not set. Cannot verify the test database schema.",
  );
  process.exit(1);
}

type ExpectedColumn = { table: string; column: string };
type ExpectedUnique = { table: string; name: string; columns: string[] };
type ExpectedUniqueIndex = {
  table: string;
  name: string;
  // Normalized predicate text from `.where(sql\`…\`)`, or "" when the index
  // is declared bare. Compared against pg_index.indpred decompiled via
  // pg_get_expr — see "Partial unique indexes" in replit.md.
  predicate: string;
  // Raw predicate text (for error messages); "" when bare.
  predicateRaw: string;
};

function collectExpected(): {
  columns: ExpectedColumn[];
  uniques: ExpectedUnique[];
  uniqueIndexes: ExpectedUniqueIndex[];
} {
  const columns: ExpectedColumn[] = [];
  const uniques: ExpectedUnique[] = [];
  const uniqueIndexes: ExpectedUniqueIndex[] = [];

  for (const value of Object.values(schema)) {
    if (!(value instanceof PgTable)) continue;
    const cfg = getTableConfig(value as PgTable);
    const tableName = cfg.name;

    for (const col of cfg.columns) {
      columns.push({ table: tableName, column: col.name });
      if (col.isUnique && col.uniqueName) {
        uniques.push({
          table: tableName,
          name: col.uniqueName,
          columns: [col.name],
        });
      }
    }

    for (const u of cfg.uniqueConstraints) {
      const name = (u as { name?: string }).name;
      const cols = ((u as { columns?: { name: string }[] }).columns ?? []).map(
        (c) => c.name,
      );
      if (name) uniques.push({ table: tableName, name, columns: cols });
    }

    for (const idx of cfg.indexes) {
      const idxCfg = (
        idx as {
          config?: { name?: string; unique?: boolean; where?: SQL };
        }
      ).config;
      if (idxCfg?.unique && idxCfg.name) {
        let predicateRaw = "";
        if (idxCfg.where) {
          try {
            predicateRaw = dialect.sqlToQuery(idxCfg.where, "indexes").sql;
          } catch (err) {
            console.error(
              `[schema-drift] Failed to render WHERE predicate for unique index "${idxCfg.name}":`,
              err,
            );
            process.exit(1);
          }
        }
        uniqueIndexes.push({
          table: tableName,
          name: idxCfg.name,
          predicate: normalizePredicate(predicateRaw),
          predicateRaw,
        });
      }
    }
  }

  return { columns, uniques, uniqueIndexes };
}

// `--names-only` skips the column/table existence checks and only verifies
// unique constraint / unique index *names*. This is what `script/run-tests.ts`
// runs BEFORE `script/db-sync.ts`, so a fresh dump or DB reset that
// re-introduces a legacy `<table>_<column>_key` name fails `npm test` fast
// with an actionable rename hint, instead of `script/realign-schema-constraints.ts`
// silently auto-healing it.
const NAMES_ONLY = process.argv.includes("--names-only");

async function main() {
  const expected = collectExpected();
  const tables = Array.from(
    new Set(expected.columns.map((e) => e.table)),
  ).sort();

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });

  let actualColumns: Map<string, Set<string>> = new Map();
  // Map<tableName, Map<constraintName, columnList sorted>>
  let actualUniques: Map<string, Map<string, string[]>>;
  // Map<tableName, Map<indexName, predicate>> — only true UNIQUE INDEXes
  // that are NOT backing a UNIQUE/PRIMARY KEY constraint (those show up as
  // constraints). `predicate` is pg_get_expr(indpred, indrelid) (decompiled
  // partial-index WHERE clause) or "" for non-partial indexes.
  let actualUniqueIndexes: Map<string, Map<string, string>>;

  try {
    // Always load column existence — needed for `absentTables` so that
    // --names-only mode can skip drift checks for tables that don't yet
    // exist (first-time DB bootstrap), and full mode needs it to flag
    // missing columns.
    const colRes = await pool.query<{
      table_name: string;
      column_name: string;
    }>(
      `SELECT table_name, column_name
         FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = ANY($1::text[])`,
      [tables],
    );
    for (const row of colRes.rows) {
      let set = actualColumns.get(row.table_name);
      if (!set) {
        set = new Set();
        actualColumns.set(row.table_name, set);
      }
      set.add(row.column_name);
    }

    const uqRes = await pool.query<{
      table_name: string;
      conname: string;
      columns: string[];
    }>(
      `SELECT cls.relname AS table_name,
              con.conname,
              array_agg(att.attname::text ORDER BY att.attname)::text[] AS columns
         FROM pg_constraint con
         JOIN pg_class cls ON cls.oid = con.conrelid
         JOIN pg_namespace ns ON ns.oid = cls.relnamespace
         JOIN unnest(con.conkey) WITH ORDINALITY AS k(attnum, ord) ON TRUE
         JOIN pg_attribute att
           ON att.attrelid = con.conrelid AND att.attnum = k.attnum
        WHERE ns.nspname = 'public'
          AND con.contype = 'u'
          AND cls.relname = ANY($1::text[])
        GROUP BY cls.relname, con.conname`,
      [tables],
    );
    actualUniques = new Map();
    for (const row of uqRes.rows) {
      let m = actualUniques.get(row.table_name);
      if (!m) {
        m = new Map();
        actualUniques.set(row.table_name, m);
      }
      m.set(row.conname, [...row.columns].sort());
    }

    const idxRes = await pool.query<{
      table_name: string;
      indexname: string;
      predicate: string | null;
    }>(
      `SELECT cls.relname AS table_name,
              idx_cls.relname AS indexname,
              pg_get_expr(i.indpred, i.indrelid) AS predicate
         FROM pg_index i
         JOIN pg_class idx_cls ON idx_cls.oid = i.indexrelid
         JOIN pg_class cls ON cls.oid = i.indrelid
         JOIN pg_namespace ns ON ns.oid = cls.relnamespace
        WHERE ns.nspname = 'public'
          AND i.indisunique = TRUE
          AND NOT EXISTS (
            SELECT 1 FROM pg_constraint c
             WHERE c.conindid = i.indexrelid
          )
          AND cls.relname = ANY($1::text[])`,
      [tables],
    );
    actualUniqueIndexes = new Map();
    for (const row of idxRes.rows) {
      let m = actualUniqueIndexes.get(row.table_name);
      if (!m) {
        m = new Map();
        actualUniqueIndexes.set(row.table_name, m);
      }
      m.set(row.indexname, row.predicate ?? "");
    }
  } finally {
    await pool.end();
  }

  const missingTables: string[] = [];
  const missingColumns: ExpectedColumn[] = [];
  // Tables that simply don't exist yet (e.g. first-time bootstrap on an
  // empty DB). In --names-only mode we silently skip drift checks for
  // these — `script/db-sync.ts` will create them via `drizzle-kit push`
  // immediately afterwards. In full mode they're reported as missing
  // tables (unchanged from the original behavior).
  const absentTables = new Set<string>();
  for (const table of tables) {
    const cols = actualColumns.get(table);
    if (!cols || cols.size === 0) {
      absentTables.add(table);
    }
  }
  if (!NAMES_ONLY) {
    for (const table of tables) {
      if (absentTables.has(table)) {
        missingTables.push(table);
        continue;
      }
      const cols = actualColumns.get(table)!;
      for (const { column } of expected.columns.filter(
        (e) => e.table === table,
      )) {
        if (!cols.has(column)) {
          missingColumns.push({ table, column });
        }
      }
    }
  }

  // Unique-constraint name drift. For every expected unique constraint that
  // is missing under its canonical name, look for a constraint on the same
  // table covering the same columns and report it as a rename.
  type UniqueDrift =
    | { kind: "rename"; table: string; from: string; to: string }
    | { kind: "missing"; table: string; name: string; columns: string[] };
  const uniqueDrift: UniqueDrift[] = [];
  for (const exp of expected.uniques) {
    if (absentTables.has(exp.table)) continue;
    const tableUniques = actualUniques.get(exp.table) ?? new Map();
    if (tableUniques.has(exp.name)) continue;
    const expCols = [...exp.columns].sort().join(",");
    let renameFrom: string | undefined;
    for (const [name, cols] of tableUniques) {
      if (cols.join(",") === expCols) {
        renameFrom = name;
        break;
      }
    }
    if (renameFrom) {
      uniqueDrift.push({
        kind: "rename",
        table: exp.table,
        from: renameFrom,
        to: exp.name,
      });
    } else {
      uniqueDrift.push({
        kind: "missing",
        table: exp.table,
        name: exp.name,
        columns: exp.columns,
      });
    }
  }

  // Unique-index name drift. Drizzle's `uniqueIndex("name")` declarations
  // become real CREATE UNIQUE INDEX statements (not constraints), so they
  // live in pg_index — not pg_constraint.
  type IndexDrift =
    | { kind: "missing"; table: string; name: string }
    // Predicate drift on a partial unique index. drizzle-kit treats the
    // WHERE clause as part of the index identity, so a mismatch causes
    // drift on every push and may even prompt to recreate the index.
    // See replit.md → "Partial unique indexes".
    | {
        kind: "predicate";
        table: string;
        name: string;
        expected: string;
        actual: string;
      };
  const indexDrift: IndexDrift[] = [];
  for (const exp of expected.uniqueIndexes) {
    if (absentTables.has(exp.table)) continue;
    const m = actualUniqueIndexes.get(exp.table) ?? new Map<string, string>();
    if (!m.has(exp.name)) {
      indexDrift.push({ kind: "missing", table: exp.table, name: exp.name });
      continue;
    }
    const actualPredicate = m.get(exp.name) ?? "";
    if (normalizePredicate(actualPredicate) !== exp.predicate) {
      indexDrift.push({
        kind: "predicate",
        table: exp.table,
        name: exp.name,
        expected: exp.predicateRaw,
        actual: actualPredicate,
      });
    }
  }

  const ok =
    missingTables.length === 0 &&
    missingColumns.length === 0 &&
    uniqueDrift.length === 0 &&
    indexDrift.length === 0;

  if (ok) {
    if (NAMES_ONLY) {
      console.log(
        `[schema-drift] OK (names-only) — verified ${expected.uniques.length} unique constraints / ${expected.uniqueIndexes.length} unique indexes against the database.`,
      );
    } else {
      console.log(
        `[schema-drift] OK — verified ${tables.length} tables / ${expected.columns.length} columns / ${expected.uniques.length} unique constraints / ${expected.uniqueIndexes.length} unique indexes against the database.`,
      );
    }
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
  if (uniqueDrift.length > 0) {
    console.error("Unique constraint name drift:");
    for (const d of uniqueDrift) {
      if (d.kind === "rename") {
        console.error(
          `  - ${d.table}: rename ${d.from} -> ${d.to}  (ALTER TABLE ${d.table} RENAME CONSTRAINT ${d.from} TO ${d.to};)`,
        );
      } else {
        console.error(
          `  - ${d.table}: missing UNIQUE constraint "${d.name}" on (${d.columns.join(", ")})`,
        );
      }
    }
    console.error("");
  }
  if (indexDrift.length > 0) {
    console.error("Unique index drift:");
    for (const d of indexDrift) {
      if (d.kind === "missing") {
        console.error(`  - ${d.table}: missing UNIQUE INDEX "${d.name}"`);
      } else {
        const expected = d.expected ? `WHERE ${d.expected}` : "(no WHERE)";
        const actual = d.actual ? `WHERE ${d.actual}` : "(no WHERE)";
        console.error(
          `  - ${d.table}: partial-index predicate drift on "${d.name}"\n` +
            `      schema declares: ${expected}\n` +
            `      database has:    ${actual}\n` +
            `      Update either shared/schema.ts (the .where(sql\`…\`) clause) or the live index so they match. ` +
            `See replit.md → "Partial unique indexes".`,
        );
      }
    }
    console.error("");
  }
  console.error(
    "Run `npx tsx script/db-sync.ts` to realign legacy `_key` constraint names and re-push the schema (see replit.md → \"Database schema sync\" for the alignment SQL template).",
  );
  process.exit(1);
}

main().catch((err) => {
  console.error("[schema-drift] Failed to verify database schema:", err);
  process.exit(1);
});
