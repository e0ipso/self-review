---
id: 1
group: "release-provenance"
dependencies: []
status: "completed"
created: 2026-10-01
skills:
  - github-actions
  - secure-coding
complexity_score: 6
complexity_notes: "Security-sensitive workflow trust boundary; validation must use synthetic events only, never a live release."
execution_profile: "complex-architecture"
---
# Enforce trusted provenance before privileged release execution (A1)

## Objective
Make `.github/workflows/release.yml` refuse to execute any checked-out repository code with publication privileges unless the triggering `workflow_run` is a successful `CI` run from a same-repository `push` to `main` whose head commit is the one checked out. Isolate install/build from publication permissions and minimize credential persistence.

## Skills Required
GitHub Actions workflow authoring (`workflow_run` semantics, job permissions, artifacts) and secure-coding judgement for CI trust boundaries.

## Acceptance Criteria
- [x] A provenance gate job runs **before** any `actions/checkout` of the triggering SHA and before `npm ci`; it requires `github.event.workflow_run.conclusion == 'success'`, `event == 'push'`, `head_branch == 'main'`, `head_repository.full_name == github.repository` (and repository id equality), and that `head_sha` is the current tip (or an ancestor reachable from) `refs/heads/main` of this repository queried via the API, not from the checkout.
- [x] Jobs that run `npm ci`/build/package scripts have read-only `contents` permission and no `id-token`, `issues`, `pull-requests` or `actions: write`; only the final publication job holds write/OIDC permissions, and it does not run `npm ci` lifecycle scripts from the checkout without the gate having passed (gate is a hard `needs:` dependency).
- [x] Every `actions/checkout` sets `persist-credentials: false` unless a later step demonstrably needs the token, in which case the token is passed via `env` only to that step.
- [x] Workflow shell steps receive event fields through `env:` variables, never `${{ }}` interpolation inside `run:` scripts (e.g. the existing `git checkout -B ${{ github.event.workflow_run.head_branch }}`).
- [x] Third-party actions used in privileged jobs (notably any Nix installer tracking `@main`) are pinned to full commit SHAs with a version comment.
- [x] A shell regression script `scripts/test/release-provenance.test.sh` (or equivalent) evaluates the gate logic against synthetic event JSON for: fork PR from branch `main`, failed CI, `pull_request` event, wrong branch, wrong repository, head SHA not on main, and the trusted push — and exits 0 with only the trusted case accepted. Run it: `bash scripts/test/release-provenance.test.sh` → all checks pass.
- [x] Existing `bash scripts/test/resolve-release-tag.test.sh` and the flake-hash regression suite still pass.
- [x] A short "Release prerequisites" section (in the existing release documentation location, or `docs/release-security.md` if none) lists owner-managed settings that the workflow cannot prove: fork PR workflow approval, branch protection on `main`, npm trusted-publisher/environment restrictions, and whether a protected `release` environment is configured. Read what is inspectable with `gh api` read-only (e.g. `gh api repos/{owner}/{repo}/environments`, branch protection) and record actual findings or "not inspectable with available permissions".

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `.github/workflows/release.yml`, possibly `.github/workflows/ci.yml` (only if needed to expose provenance), a gate script (e.g. `scripts/release/verify-provenance.sh` taking event JSON path + expected repo/branch, used by both the workflow and the test), `scripts/test/release-provenance.test.sh`, release docs.
- The gate must not depend on any file from the untrusted checkout. Either inline the check in the workflow using `github.event` + `gh api`, or check out the default branch's trusted copy of the script (`ref: ${{ github.event.repository.default_branch }}`) — never the triggering SHA — before the gate passes.
- Use artifacts (`actions/upload-artifact`/`download-artifact`) to pass built `.deb`/`.rpm` from an unprivileged build job to the privileged publish job, if the build currently happens in the same job as publication.

## Input Dependencies
None.

## Output Artifacts
Hardened `release.yml`, gate script + synthetic-event regression suite, release prerequisite documentation (consumed by task 24).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `.github/workflows/release.yml` and `.github/workflows/ci.yml` fully, plus `docs/security-audit-2026-10-01.md` section A1 and `docs/security-audit-2026-10-01-sol/sol-p1-release.md`.
2. Current problem: `on: workflow_run: branches: [main]` matches a fork branch named `main`; the job checks only `conclusion == 'success'`, checks out `head_sha` and runs `npm ci` + `npx semantic-release` with `contents/actions/issues/pull-requests: write` and `id-token: write`.
3. Restructure into jobs:
   - `provenance` (permissions: `contents: read`, `actions: read`): no checkout of the triggering SHA. Verify with `env:`-passed values: `EVENT`, `CONCLUSION`, `HEAD_BRANCH`, `HEAD_REPO`, `REPO`, `HEAD_SHA`. Then `gh api repos/$REPO/commits/main --jq .sha` or `gh api repos/$REPO/compare/$HEAD_SHA...main --jq .status` (accept `identical` or `ahead`, meaning HEAD_SHA is reachable from main). Fail closed on any API error.
   - The release/semantic-release job `needs: provenance`. semantic-release needs `contents: write`, `issues: write`, `pull-requests: write`, and `id-token: write` for npm provenance — keep those only here. Consider `npm ci --ignore-scripts` only if the build still works (verify locally with `npm ci --ignore-scripts && npm run build:packages` or note why scripts are required); do not break the release.
   - Keep the concurrency group.
4. Replace `run: git checkout -B ${{ github.event.workflow_run.head_branch }}` with `env: HEAD_BRANCH: ...` and `run: git checkout -B "$HEAD_BRANCH"` — but after the gate HEAD_BRANCH is always `main`; hardcode `main`.
5. Put the decision logic in a small bash script that reads a JSON event file (`$GITHUB_EVENT_PATH`) with `jq`, so the regression test can feed synthetic payloads. The commit-reachability API call should be injectable (e.g. via an env var pointing to a stub command) so tests run offline.
6. Never run a live fork attack or publish a test release. Validate YAML with `npx --yes yaml-lint` or `python3 -c 'import yaml,sys; yaml.safe_load(open(sys.argv[1]))' .github/workflows/release.yml`, and if `actionlint` is available run it.
7. Do not commit; the orchestrator commits per phase. Other tasks run in parallel in this workspace; edit only the files listed here. Do not touch unrelated uncommitted changes (`.agents/`, `skills-lock.json`, `docs/*audit*`).

Test philosophy: write a few tests, mostly integration. Test custom logic, critical workflows and edge cases; do not test third-party/framework behavior or trivial code. Combine related scenarios into one suite.
</details>
