---
id: 16
group: "remote"
dependencies: [10]
status: "pending"
created: 2026-10-01
skills:
  - typescript
  - git
complexity_score: 6
complexity_notes: "Correctness-sensitive forge provenance plus consolidating GUI and headless mapping so outputs agree."
execution_profile: "complex-architecture"
---
# Activate only head-verified forge suggestions and share remote materialize/filter/map (R05, simplification 5)

## Objective
GitLab note positions keep their revision provenance (`head_sha`, and `base_sha`/`start_sha` where useful); a suggestion becomes actionable only when its position's head matches the reviewed (materialized) head. Stale/missing/unverifiable positions keep their discussion text but get no Apply control. The GUI bootstrap and `fetch-comments` share the same materialize → load → filter → map primitives so they produce identical suggestions for the same effective configuration and diff, and the preliminary pre-diff mapping that is immediately discarded is removed.

## Skills Required
TypeScript forge-provider/mapper logic and Git revision semantics.

## Acceptance Criteria
- [ ] `ForgeThreadAnchor` (in `forge-provider.ts`) carries an optional `headSha` (and other position SHAs if needed); `gitlab-provider.ts:29–38,167–189` populates it from each note's `position.head_sha` and no longer hard-codes `outdated: false` when it cannot know. GitHub provider sets the equivalent from its API (`commit_id`/`original_commit_id`) or leaves it undefined, with documented semantics.
- [ ] `thread-mapper.ts:184` creates a `Suggestion` only when the anchor's head SHA is present and equals the reviewed head SHA (for GitHub, apply the same rule if a SHA is available; otherwise document the existing outdated-flag rule). Otherwise the thread is mapped with its body intact and `suggestion: null`.
- [ ] Synthetic GitLab payload tests through the real provider and mapper: current head → actionable suggestion with original code from the diff; `OLD_HEAD` → no suggestion, body retained; missing position SHA → no suggestion; multi-line current position → correct range.
- [ ] A shared helper (e.g. `loadRemoteReview` in `remote-mode.ts`) is used by both `bootstrapRemoteDiff` and `runFetchComments` for load/ignore-filter/map; both apply the same effective ignore configuration. A test feeds the same synthetic forge response + repo through both paths and asserts identical suggestions, including for an ignored path.
- [ ] The preliminary mapping before the diff exists is removed; the GUI-degrades vs headless-fails thread-fetch error policy is preserved (tests for both).
- [ ] `fetch-comments` publishes via `publishReview` (from task 10) — keep it.
- [ ] `npm run test:unit` and `npm run typecheck:packages` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/core/src/forge-provider.ts`, `gitlab-provider.ts`, `github-provider.ts`, `thread-mapper.ts`, `remote-mode.ts`, `fetch-comments.ts`, related tests. Do not change `materializer.ts` ref handling (task 22).

## Input Dependencies
Task 10 (fetch-comments already switched to the publisher).

## Output Artifacts
Shared remote load/filter/map helper (task 22 wraps it in session lifetime ownership).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R05 and R16 (mapping paragraph), and the GitLab discussions API position semantics (https://docs.gitlab.com/api/discussions/).
2. Reviewed head SHA is available from the materialization result (`headSha`) / `RemoteSessionInfo`.
3. AGENTS.md currently claims "the app and the subcommand produce the same suggestions for the same PR/MR"; after this task that holds for the same effective ignore configuration — task 24 updates the docs; note the final behavior in your output.
4. Concurrency: tasks 11 (apply/core review-handlers), 14 (Electron main) and 15 (serve) run in the same phase. `remote-mode.ts`/`fetch-comments.ts` are yours this phase; re-read before editing `index.ts`; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (real provider + mapper with synthetic API payloads and a real Git fixture). Test the verification rule and parity; skip trivial getters.
</details>
