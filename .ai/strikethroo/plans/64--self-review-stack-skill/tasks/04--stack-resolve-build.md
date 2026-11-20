---
id: 4
group: "helper"
dependencies: [3]
status: "pending"
created: 2026-11-20
skills:
  - typescript
  - git-plumbing
complexity_score: 6
complexity_notes: "Core logic of the feature (argument resolution and the read-only stack build). Split from check-imports/table (task 5) to stay below 7; the two subcommands share the resolution code and must be tested together."
---
# Implement the helper's resolve and build subcommands

## Objective
Port `stack.py`'s `resolve` and `build` to TypeScript in `packages/skill-scripts/src/stack/`, reusing core's `parseGitDiffArgs`/`describeGitDiffSides`, with integration tests that run the committed bundle against disposable git repositories.

## Skills Required
- `typescript`: the helper source.
- `git-plumbing`: `read-tree`, `update-index --index-info`, `write-tree`, `commit-tree`, `update-ref`, `GIT_INDEX_FILE`, `diff --raw`.

## Acceptance Criteria
- [ ] `node stack.cjs resolve <git-diff-args...>` prints `base`, `target` (with a one-line summary of what is compared), `paths` (when pathspecs given), `options` (pass-through display options or `(none)`), `diff` (shortstat) and one `<status>\t<path>` line per changed path; prints `No changes to stack.` and exits 3 when nothing changed. Supported shapes: no args, `--staged`/`--cached [rev]`, `<rev>`, `A..B`, `A B`, `A...B`, `--merge-base`, `-- <paths>`.
- [ ] `resolve` refuses, with a clear message and non-zero exit, `--no-index`, an `unknown` side from `describeGitDiffSides`, `-R`, and more than two revisions.
- [ ] `node stack.cjs build <spec.json>` validates the spec and refuses (creating nothing) when a changed path is in no step, a path is in two steps, a listed path is not in the diff, a slug repeats, a branch name is invalid, or any branch already exists under the prefix; every problem is listed.
- [ ] On success it builds every commit on a throwaway index, confirms `git diff --raw --no-renames --no-abbrev -z <base> <top>` equals the original diff's raw output, then creates `refs/heads/<prefix>/<slug>` with `update-ref` and an empty old value; prints each branch, short SHA and subject, the reproduction confirmation, and each step's diff args (pass-through options then `<previous>..<step-branch>`, step 1's previous being the base's short SHA).
- [ ] `trailers` in the spec is optional and defaults to none.
- [ ] Integration tests (vitest, in `packages/skill-scripts`) run the built bundle with `node` against temp repos and cover: each supported argument shape resolves; each refusal above; a three-step build reproduces the diff; after `build`, `git status --porcelain`, `HEAD`, the real index's bytes and the pre-existing branch list are unchanged; unstaged changes on top of a staged change stack correctly (index commit created).
- [ ] The bundle is rebuilt and committed; `npm run test:unit --workspace @self-review/skill-scripts` (including the staleness test) and `npm run typecheck:packages` exit 0.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Source of truth for behavior: the attached `stack.py` (handoff artifact `self-review-guide-stacked-diff/scripts/stack.py`; a copy is at `/tmp/claude-501/-home-m4olivei-guest-github-com-m4olivei-self-review/c696484f-8d60-4eea-b68c-39f21cda985d/scratchpad/artifact-files/e382e78b-0189-4534-a516-bab0cc39f9a1/self-review-guide-stacked-diff/scripts/stack.py` if still present; otherwise fetch it with the Artifact tool's `read` action and `path` on https://claude.ai/artifact/V6TTMmykVA87DKaRfAT4L8). Port `git`, `snapshot`, `index_commit`, `resolve`, `changed`, `raw_diff`, `cmd_resolve`, `cmd_build`, `shortstat`, `diffstat`.
- Use `parseGitDiffArgs` for option/positional/`--` classification and `describeGitDiffSides` for which snapshots are compared; then map sides to a base commit and target tree: `revision` → `rev-parse --verify <rev>^{commit}`; `merge-base` → `git merge-base`; `index` → tree from a copy of the index (`GIT_INDEX_FILE` copy, `write-tree`); `working-tree` → copy of the index plus `git add --update` from the top level, then `write-tree`; when the old side is the index (plain `git diff`), commit that index tree on HEAD with `commit-tree` so the stack has a commit base (reuse HEAD when the trees match).
- Positionals that are not revisions are paths (as git does); keep the `stack.py` behavior.
- Spawn git with `child_process.spawnSync` (`encoding: 'utf8'`, `maxBuffer` large enough for big diffs) and arrays of arguments, never a shell string.
- The spec format stays as in `stack.py`'s docstring (`diff_args`, `prefix`, `trailers`, `steps[{slug, subject, description, files}]`), with neutral examples in usage text.
- Never touch the real index, working tree, HEAD or existing refs; all temp files under `fs.mkdtempSync(os.tmpdir())`, removed in `finally`.

## Input Dependencies
- Task 3: package, tsup bundle pipeline, staleness test, placeholder `cli.ts`.

## Output Artifacts
- `resolve` and `build` subcommands in source and in the committed `stack.cjs`; shared helpers (`git`, `shortstat`, `diffstat`, spec loading, `branch`, `stackBase`) that task 5 reuses.

## Implementation Notes
<details>
<summary>Guidance</summary>

- Structure: `src/stack/git.ts` (spawn helpers), `src/stack/resolve.ts`, `src/stack/build.ts`, `src/stack/spec.ts`, `src/stack/stats.ts`, `src/stack/cli.ts` dispatch. Keep functions small and single-purpose (AGENTS.md "Code Reuse").
- `describeGitDiffSides` returns `{ oldSide, newSide }` with kinds such as `working-tree`, `index`, `revision` (`rev`, `implicit`), `merge-base` (`left`, `right`), `unknown` (`reason`); read its source in `packages/core/src/source-identity.ts` (or the module task 3 extracted it into) and handle each kind it can return. It already flips sides for `-R`; refuse `-R` explicitly by checking the parsed options.
- Pass-through options: every parsed option except `--staged`, `--cached`, `--merge-base` (and the refused ones). Keep their original spelling and any separate value git consumes (use `parseGitDiffArgs`'s option records).
- Raw-diff comparison must use the same pathspecs as the original arguments on the original side only (as `stack.py` does: `raw_diff(base, top)` vs `raw_diff(base, target, paths)`).
- Exit codes: `resolve` 0 ok, 3 no changes, 1 refusal/error; `build` 0 ok, 1 refusal/error.
- Tests: write `src/stack/stack.process.test.ts` that builds a fixture repo per test in `os.tmpdir()` with `git init -q -b main`, `user.name`/`user.email` config, `commit.gpgsign=false`, and runs `node <repo>/.agents/skills/self-review-stack/scripts/stack.cjs` with `cwd` set to the fixture (use `process.execPath`). Snapshot the index with `fs.readFileSync('.git/index')` before/after. Combine scenarios into a few `describe` blocks (resolution shapes, refusals, build reproduction and read-only guarantee) rather than one test per trivial case.
- Test philosophy for this plan: write a few tests, mostly integration. Test custom logic, critical workflows, edge cases and error conditions in core functionality, and integration points; do not test third-party library behavior, trivial getters or static configuration.
- Rebuild with `npm run build:skills --workspace @self-review/skill-scripts` before running tests; commit source, tests and bundle together.
- Commit: `feat(skill-scripts): port stack resolve and build to TypeScript`, no AI trailers.
</details>
