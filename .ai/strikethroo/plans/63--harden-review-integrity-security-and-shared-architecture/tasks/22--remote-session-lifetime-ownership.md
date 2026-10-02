---
id: 22
group: "remote"
dependencies: [16, 21]
status: "completed"
created: 2026-10-01
skills:
  - nodejs-subprocess
  - git
complexity_score: 7
complexity_notes: "Concurrency-safe ref ownership plus cancellation and cleanup across desktop, welcome and headless lifetimes."
execution_profile: "complex-architecture"
---
# Own remote refs, cancellation and cleanup for the whole session (R16)

## Objective
Remote materialization captures an immutable per-session snapshot so concurrent sessions (same or different PR) never receive another session's SHAs or delete its refs; Git subprocesses have bounded, cancellable lifetimes; temporary-clone cleanup is registered the moment the clone directory is acquired and one lifetime boundary covers clone/fetch, load, filter and mapping across desktop startup, welcome screen and headless `fetch-comments`.

## Skills Required
Node.js child-process lifetime/cancellation and Git ref semantics.

## Acceptance Criteria
- [x] `materializer.ts:47–74,200–214`: fetches into per-session refs (e.g. `refs/self-review/<session-uuid>/base|head`) and resolves SHAs from the same fetch (e.g. `git fetch --porcelain` output or `rev-parse` of the unique refs); refs are deleted only by their owning session on cleanup. A controlled-interleaving test through the real materializer (two sessions, same clone, different PRs and same PR) shows each session gets its own SHAs and neither cleanup removes the other's refs.
- [x] The materializer Git runner supports an `AbortSignal` and a per-command timeout; on abort/timeout the child is killed (and its process group where applicable) and the promise rejects with a typed cancellation error. Credential prompting behavior is unchanged (no blanket `GIT_TERMINAL_PROMPT=0` unless it was already set).
- [x] Temporary clone cleanup is registered immediately after the temp directory is created (before cloning), and a single try/finally (or owned disposable) spans materialize → load → filter → map (`remote-mode.ts:214–243`). Injected exceptions at each stage (clone, fetch, load, filter, map) leave no temp directory and no child processes (tests).
- [x] Desktop startup timeout (`src/main/main.ts:151–154,209`) aborts the in-flight remote bootstrap through the signal and waits for cleanup before exiting; welcome-screen `remote:open-url` and headless `fetch-comments` use the same signal/cleanup ownership with their own documented limits.
- [x] `npm run test:unit`, `npm run typecheck`, `npm run typecheck:packages` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/core/src/materializer.ts`, `packages/core/src/remote-mode.ts`, `packages/core/src/fetch-comments.ts` (lifetime only), `src/main/main.ts` (remote startup/timeout), `src/main/ipc-handlers.ts` (`remote:open-url` lifetime), tests.

## Input Dependencies
Task 16 (shared remote load/filter/map helper), task 21 (startup restructuring in `main.ts`).

## Output Artifacts
Session-owned remote lifetime.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R16 and `docs/security-audit-2026-10-01-sol/sol-p7-remote.md`.
2. `child_process.spawn`/`execFile` accept `signal` (Node ≥ 15) and `timeout`; prefer `spawn` with `detached: true` + `process.kill(-pid)` if Git spawns helpers that must die too — verify on Linux.
3. Concurrency: task 23 (React/config defaults/themes) runs in the same phase; no overlap expected beyond `packages/core/src/index.ts`. Re-read before editing; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (real Git bare repos as fake remotes in temp dirs, controlled interleaving via an injectable runner). Test concurrency and cleanup; skip trivial helpers.
</details>
