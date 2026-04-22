import { spawn } from "node:child_process";

function run(cmd: string, args: string[]): Promise<number> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: ["ignore", "inherit", "inherit"],
      env: process.env,
    });
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function main() {
  // 1) Reconcile any legacy constraint names so drizzle-kit doesn't prompt
  //    "Do you want to truncate <table>?" and block CI / agent runs.
  const realignCode = await run("tsx", ["script/realign-schema-constraints.ts"]);
  if (realignCode !== 0) {
    process.exit(realignCode);
  }

  // 2) Apply the live schema. `--force` is required so drizzle-kit doesn't
  //    pause on potentially-destructive prompts; the realign step above
  //    handles the only legitimately-non-destructive prompt we know about.
  const pushCode = await run("npx", ["drizzle-kit", "push", "--force"]);
  if (pushCode !== 0) {
    process.exit(pushCode);
  }

  // 3) Verify drizzle's view of the schema matches the live DB columns.
  const driftCode = await run("tsx", ["script/check-schema-drift.ts"]);
  if (driftCode !== 0) {
    process.exit(driftCode);
  }
}

main().catch((err) => {
  console.error("[db-sync] Failed:", err);
  process.exit(1);
});
