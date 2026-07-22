// Periodic GitHub backup sync.
//
// The GitHub copy of this project once fell 659 commits behind because pushes
// only happened manually and failures were invisible. This module pushes the
// local `main` branch to GitHub on the existing hourly scheduler (no-op when
// already up to date) and emails the admins when a push fails, so a broken
// token/scope is noticed immediately instead of months later.
//
// Notes:
// - The token MUST have the `workflow` scope (repo history contains
//   .github/workflows files); without it GitHub rejects the whole push.
// - Skipped in deployments (no git checkout there) and when GITHUB_TOKEN is
//   missing.
// - Failure emails are rate-limited to once per 24h so an outage doesn't spam.

import { execFile } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { notifyAdminGithubSyncFailed } from "./email";

const execFileAsync = promisify(execFile);

const GITHUB_REPO = "github.com/bounsivongsa-design/Local-365.git";
const BRANCH = "main";
const FAILURE_EMAIL_COOLDOWN_MS = 24 * 60 * 60 * 1000;

let lastFailureEmailAt = 0;

// Never let the token leak into logs or emails.
function scrubToken(text: string, token: string): string {
  if (!text) return text;
  const variants = [token, encodeURIComponent(token)];
  let out = text;
  for (const v of variants) {
    if (v) out = out.split(v).join("[REDACTED]");
  }
  return out;
}

export type GithubSyncFailureNotifier = typeof notifyAdminGithubSyncFailed;

export async function syncGithubBackup(
  notifier: GithubSyncFailureNotifier = notifyAdminGithubSyncFailed,
): Promise<"pushed" | "up-to-date" | "skipped" | "failed"> {
  // Deployed containers don't have the git checkout — only run in the workspace.
  if (process.env.REPLIT_DEPLOYMENT) return "skipped";
  if (!fs.existsSync(path.join(process.cwd(), ".git"))) return "skipped";

  const token = process.env.GITHUB_TOKEN?.trim();
  if (!token) {
    console.warn("[github-sync] GITHUB_TOKEN not set — skipping GitHub backup push");
    return "skipped";
  }

  const remoteUrl = `https://x-access-token:${encodeURIComponent(token)}@${GITHUB_REPO}`;

  try {
    const { stdout: localOut } = await execFileAsync(
      "git",
      ["--no-optional-locks", "rev-parse", BRANCH],
      { timeout: 30_000 },
    );
    const localSha = localOut.trim();

    const { stdout: remoteOut } = await execFileAsync(
      "git",
      ["--no-optional-locks", "ls-remote", remoteUrl, `refs/heads/${BRANCH}`],
      { timeout: 60_000 },
    );
    const remoteSha = remoteOut.split("\t")[0]?.trim() || "";

    if (remoteSha === localSha) {
      return "up-to-date";
    }

    await execFileAsync("git", ["push", remoteUrl, `${BRANCH}:${BRANCH}`], {
      timeout: 5 * 60_000,
      maxBuffer: 10 * 1024 * 1024,
    });
    console.log(
      `[github-sync] Pushed ${localSha.slice(0, 7)} to GitHub (remote was ${remoteSha ? remoteSha.slice(0, 7) : "empty"})`,
    );
    return "pushed";
  } catch (err: any) {
    const rawMsg = [err?.message, err?.stderr].filter(Boolean).join("\n");
    const msg = scrubToken(rawMsg || "Unknown error", token);
    console.error("[github-sync] GitHub backup push FAILED:", msg);

    const now = Date.now();
    if (now - lastFailureEmailAt > FAILURE_EMAIL_COOLDOWN_MS) {
      lastFailureEmailAt = now;
      try {
        await notifier(msg);
      } catch (emailErr: any) {
        console.error("[github-sync] Failed to send failure alert email:", emailErr?.message);
      }
    }
    return "failed";
  }
}
