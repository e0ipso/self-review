---
id: 19
group: "source-identity"
dependencies: [18]
status: "pending"
created: 2026-10-01
skills:
  - git
  - typescript
complexity_score: 5
execution_profile: "standard-implementation"
---
# Expand context without changing the reviewed comparison or file (R07)

## Objective
Context expansion re-runs Git with the session's structured argv, strips only context flags (including bare `-U`/`--unified` whose value is optional and attached), preserves revisions/pathspecs and relative-path interpretation, includes both paths for renames/copies, and selects the intended file from the result instead of the first parsed entry.

## Skills Required
Git diff argument semantics and TypeScript.

## Acceptance Criteria
- [ ] `expandContext` (`review-handlers.ts:448–484`) builds its command from `session.source.gitDiffArgv` (task 18), not from a re-split string.
- [ ] Context-flag stripping uses the shared classifier in `git-diff-args.ts`: `-U`, `-U5`, `--unified`, `--unified=5`, `-W/--function-context` are removed without consuming the following argument; `-U HEAD` keeps `HEAD` as the revision. Regression: staged/working-tree mismatch with `-U HEAD` keeps the old side at HEAD's content after expansion.
- [ ] Renames/copies pass both old and new paths as pathspecs (with rename detection preserved), and the returned file is selected by matching `(oldPath, newPath)`; an edited staged rename expands into rename hunks, not a full addition.
- [ ] `--relative[=<dir>]` sessions and sessions launched from a subdirectory expand correctly (paths interpreted as at load time — run from the same `invocationCwd` or translate paths consistently); root/nested same-name files select the right one.
- [ ] Tests with real Git fixtures for each case above. `npm run test:unit` passes; `npm run test:e2e:electron` expand-context scenarios pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/core/src/review-handlers.ts` (`expandContext` only), `packages/core/src/git-diff-args.ts` (context-flag stripping helper), tests.

## Input Dependencies
Task 18 (structured argv + source identity + snapshot line counts).

## Output Artifacts
Correct expansion (no downstream consumers).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R07 and the expansion probes in `docs/codebase-audit-2026-10-01/core-probes.cjs`.
2. Git's `-U` takes an optional *attached* value (`-U5`); a separate `-U 5` means `-U` (default 3) followed by pathspec/revision `5`. `--unified` likewise only takes `--unified=N`.
3. Concurrency: task 20 edits `readAttachment`/attachment code in `review-handlers.ts` in the same phase. Edit only `expandContext` and helpers; re-read before every edit; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration on real Git fixtures. Test the argument edge cases; skip trivial helpers.
</details>
