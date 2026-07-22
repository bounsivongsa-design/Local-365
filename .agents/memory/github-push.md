---
name: GitHub push quirks
description: How to push this repo to GitHub and why pane pushes failed
---
- Remote: https://github.com/bounsivongsa-design/Local-365.git, branch main.
- History contains `.github/workflows/test.yml`, so any PAT used to push MUST have the `workflow` scope (classic) — otherwise GitHub rejects the whole push. The Replit Git pane surfaced this only as an opaque "PUSH_REJECTED (remote has commits...)" even for a pure fast-forward.
- **How to apply:** push from shell with the GITHUB_TOKEN secret: `git push "https://x-access-token:$(node -e 'console.log(encodeURIComponent(process.env.GITHUB_TOKEN.trim()))')@github.com/bounsivongsa-design/Local-365.git" main`. Always sed-scrub tokens from output.
- Agent shell cannot modify .git config or run replit-git-askpass (hangs/sandbox-kills); use `git --no-optional-locks` for read-only ops.
