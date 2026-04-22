import { spawn } from "node:child_process";
import { readdir } from "node:fs/promises";
import { join } from "node:path";

const TEST_ROOT = "server/__tests__";

async function runNode(args: string[]): Promise<number> {
  return await new Promise((resolve) => {
    const child = spawn("tsx", args, { stdio: "inherit", env: process.env });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

// Realign legacy constraint names, run drizzle-kit push non-interactively,
// and verify column-level drift — all in one step. See script/db-sync.ts.
const syncCode = await runNode(["script/db-sync.ts"]);
if (syncCode !== 0) {
  process.exit(syncCode);
}

async function findTestFiles(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await findTestFiles(full)));
    } else if (entry.isFile() && entry.name.endsWith(".test.ts")) {
      files.push(full);
    }
  }
  return files;
}

const files = (await findTestFiles(TEST_ROOT)).sort();

if (files.length === 0) {
  console.log(`No test files found under ${TEST_ROOT}`);
  process.exit(0);
}

const child = spawn("tsx", ["--test", ...files], {
  stdio: "inherit",
  env: process.env,
});

child.on("exit", (code) => process.exit(code ?? 1));
