---
id: 18
group: "source-identity"
dependencies: [4, 11, 13, 17]
status: "completed"
created: 2026-10-01
skills:
  - typescript-refactoring
  - git
complexity_score: 7
complexity_notes: "Introduces the structured source/snapshot model in the session contract and moves serve path authorization onto it; wide but single-concept."
execution_profile: "complex-architecture"
---
# Represent source identity explicitly and read previews/line counts from the reviewed snapshot (R13, A6)

## Objective
The review session records an explicit source identity — mode (git/directory/file/remote), physical source root (realpath), invocation CWD, structured argv (array, not a formatted string), and comparison sides (working tree, index, commit object, directory/file). One core resolver maps a session-relative path to the exact physical file used for both authorization and I/O. Image previews and expansion line counts read the exact reviewed side (index blob / commit blob / working tree / directory file) instead of the current working tree. Image reads require reviewed-path membership and a supported image type. Serve's routes use the same resolver, closing the directory/file-mode root mismatch.

## Skills Required
TypeScript refactoring of the session contract and Git object/index semantics.

## Acceptance Criteria
- [x] `@self-review/types` defines the shared contract (e.g. `ReviewSourceIdentity` with `mode`, `sourceRoot`, `invocationCwd`, `gitDiffArgv: string[]`, `oldSide`/`newSide` descriptors of kind `'working-tree' | 'index' | 'commit' | 'directory' | 'file' | 'none'` with commit SHAs resolved at load time); core stores it on `ReviewSession` at start (local git, directory, file, remote).
- [x] A core snapshot reader `readReviewedContent(session, path, side)` returns bytes from: `git show <sha>:<path>` for commits, `git show :<path>` for the index, the working tree file via the safe no-follow open (task 10 `safe-fs.ts`) for working tree/directory/file sources — always within the physical source root, rejecting symlink escapes.
- [x] `loadImage` (`review-handlers.ts:127–175`) requires `session.reviewedPaths` membership (task 11) and a previewable image type (`isPreviewableImage`); it reads the reviewed new side (or old side for deletions) via the snapshot reader. Probe regression: stage PNG ending `02`, modify working file to end `03`, staged session preview returns `…02`.
- [x] Expansion's total line count (`review-handlers.ts:474–484`) uses the snapshot reader for the relevant side; a remote session's count comes from the PR head commit, not the temp clone's checked-out default branch (test with a head file longer than the default-branch version).
- [x] `resolveSourceBaseDir` is replaced by/implemented on the source identity; serve's `validate.ts`/`server.ts` path checks (`startup.ts:83`, `server.ts:296,365`) no longer compute their own root from launch CWD — they delegate to core (authorization + I/O on the same resolved object). The audit's directory-mode escape (`link.txt` symlink, review launched from another CWD) returns an error over HTTP and the outside sentinel is not read or changed; absolute paths outside the reviewed source are rejected.
- [x] The read-only source root and the chosen Apply destination remain distinct (temp clones still require an explicit destination).
- [x] Tests: real Git fixtures with distinct HEAD/index/working-tree content for staged and commit-range sessions (image + line counts), directory and file sessions launched from a different CWD via real session handlers and real HTTP routes (with the capability from task 17). `npm run test:unit`, `npm run typecheck`, `npm run typecheck:packages` pass; `npm run test:e2e` and `npm run test:e2e:serve` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/types/src/index.ts`, `packages/core/src/review-handlers.ts` (session shape, `loadImage`, line counts, `resolveSourceBaseDir`), new `packages/core/src/snapshot-reader.ts`, `packages/core/src/startup-mode.ts`/`git-diff-loader.ts`/`remote-mode.ts` (populate identity — remote-mode only where the session is created), `packages/serve/src/validate.ts`, `packages/serve/src/server.ts` (path resolution only), `packages/serve/src/startup.ts` (root only), `src/main/main.ts`/`ipc-handlers.ts` only where they pass the root.
- Do not change expansion argument handling (task 19) or CLI parsing (task 21) beyond storing the structured argv they already produce.

## Input Dependencies
Task 4 (loader/diagnostics), task 13 (`input-budgets.ts`), task 11 (`reviewedPaths`, safe Apply), task 17 (authenticated serve routes).

## Output Artifacts
`ReviewSourceIdentity` + snapshot reader (consumed by task 19 expansion, task 20 attachments, task 21 startup).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R13 and R15, `docs/security-audit-2026-10-01.md` A6, and the probes (`docs/security-audit-2026-10-01/probes.cjs` directory-mode escape).
2. Determining sides from argv: reuse the existing classifier in `packages/core/src/git-diff-args.ts` (it already knows option arity, `--cached/--staged`, revisions). Mapping: no revisions, no `--cached` → old=index, new=working-tree; `--cached [<rev>]` → old=commit(rev||HEAD), new=index; one rev → old=commit, new=working-tree; `A..B`/`A B` → commits; `A...B` → old=merge-base(A,B), new=B. Resolve SHAs once with `git rev-parse` at load time. Unsupported/ambiguous combos → identity marks the side `'unknown'` and reads fail with a visible error, never fall back to the working tree.
3. Use `execFile` with argument arrays and `maxBuffer` bounded by `input-budgets.ts` (task 13) for `git show`.
4. Concurrency: this phase runs alone. Re-read files before editing; never revert unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration against real Git fixtures and real HTTP routes. Test snapshot fidelity and authorization; skip trivial getters.
</details>
