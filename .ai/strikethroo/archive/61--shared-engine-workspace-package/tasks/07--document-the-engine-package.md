---
id: 7
group: "shared-engine-workspace-package"
dependencies: [5]
status: "completed"
created: 2026-09-04
skills:
  - markdown
  - technical-writing
complexity_score: 3
execution_profile: "docs-and-config"
---
# Document the engine package

## Objective
Update `AGENTS.md` to describe the new layout and add a README for
`packages/engine` stating what it is and that it is private.

## Skills Required
`markdown` and `technical-writing` for the documentation edits.

## Acceptance Criteria
- [ ] `AGENTS.md`'s project structure listing shows `packages/engine` with the modules it now holds, and no longer lists the moved modules under `src/main/`.
- [ ] `AGENTS.md` no longer mentions `src/main/diff-parser.ts` or `src/main/git.ts`, and `grep -n "diff-parser\|git\.ts" AGENTS.md` returns nothing referring to those deleted paths.
- [ ] `AGENTS.md` states that `src/main/` now holds Electron-bound code, naming `relaunch-guard.ts` and `cli.ts` as the deliberate exceptions.
- [ ] The npm workspaces paragraph in `AGENTS.md` covers `@self-review/engine` and notes it is private and imported by relative source path.
- [ ] `packages/engine/README.md` exists and states the package's purpose and that it is currently private and unpublished.
- [ ] No user-facing documentation changed, because nothing user-visible changed.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
`AGENTS.md` is the AI-facing contract for this repository, so the source-tree
listing has to match reality after the move or it will mislead every future
session. The README belongs to the package and should be short.

## Input Dependencies
Task 5 must be complete so the final file layout is settled and can be described
accurately.

## Output Artifacts
An updated `AGENTS.md` and a new `packages/engine/README.md`.

## Implementation Notes

<details>
<summary>Step-by-step</summary>

1. In `AGENTS.md`, find the `## Project Structure` tree. Remove `review-handlers.ts`, `startup-mode.ts`, `fetch-comments.ts`, `remote-mode.ts` and the moved loaders from the `src/main/` block, and remove any line naming `diff-parser.ts` or `git.ts` as files under `src/main/`.
2. Add a `packages/engine/` entry to the `packages/` block, describing it as the Node-only engine layer — review handlers, startup mode, guide and diff loading, staged and untracked handling, remote PR/MR handling, `fetch-comments`, and git diff argument normalisation — and noting it is private and unpublished.
3. Update the paragraph beginning "The project uses **npm workspaces**" so it names four packages rather than three, and states that `@self-review/engine` is private and, like the others, imported by relative source path rather than through the workspace symlink.
4. Update the sentence describing where review handler logic lives. It currently points at `src/main/review-handlers.ts`; it now lives in `packages/engine/src/review-handlers.ts`, while the `ipcMain` registration stays in `src/main/ipc-handlers.ts`.
5. Write `packages/engine/README.md`: what the package is, that everything in it is Node-only with no Electron dependency, that it is private and unpublished today, and that publishing is deliberately deferred to the change that first needs it resolvable from a registry.
6. Do not touch `README.md` at the repository root or any user-facing documentation. Nothing observable changed.
</details>
