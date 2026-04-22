# Branch protection: require the test suite to pass before merging

The CI workflow in `.github/workflows/test.yml` runs the test suite on every
push and pull request. To stop pull requests from being merged while that
check is failing or pending, the `npm test` job must be configured as a
**required status check** on the default branch.

GitHub does not let us turn that on from inside the repo's source code, so a
repo admin needs to apply it once through the GitHub web UI (or API). After
it's set, no extra work is needed for future PRs.

## Status check name

The check that has to be required is:

- **Workflow:** `Tests` (from `.github/workflows/test.yml`)
- **Job name / status check context:** `npm test`

> The status check name comes from the job's `name:` field, not the job id.

## Option A — Branch protection rule (classic, quickest)

1. Open the repo on GitHub -> **Settings** -> **Branches**.
2. Under **Branch protection rules**, click **Add rule** (or edit the existing
   rule for the default branch).
3. **Branch name pattern:** the default branch (e.g. `main`).
4. Enable **Require a pull request before merging**.
5. Enable **Require status checks to pass before merging**.
   - In the search box, type `npm test` and select it. (If it doesn't show up
     yet, push a commit so the workflow runs at least once, then come back.)
   - Optionally enable **Require branches to be up to date before merging**.
6. Click **Create** / **Save changes**.

## Option B — Repository ruleset (recommended, importable)

A ready-to-import ruleset lives at
[`.github/rulesets/require-tests.json`](./rulesets/require-tests.json).

1. Open the repo on GitHub -> **Settings** -> **Rules** -> **Rulesets**.
2. Click **New ruleset** -> **Import a ruleset**.
3. Upload `.github/rulesets/require-tests.json`.
4. Confirm the target is the default branch and **Enforcement status** is
   **Active**, then click **Create**.

## Verifying it works

1. Open a PR that intentionally breaks a test.
2. Wait for the `npm test` check to report failure.
3. The **Merge** button should be disabled with a message saying required
   status checks have not passed.
