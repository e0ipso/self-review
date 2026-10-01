---
id: 6
group: "react-session"
dependencies: []
status: "completed"
created: 2026-10-01
skills:
  - react
  - typescript
complexity_score: 6
complexity_notes: "Published-package contract change (initialization vs update vs replacement) across ReviewProvider and SingleFileReview."
execution_profile: "standard-implementation"
---
# Define explicit initialization, update and replacement semantics for published React sessions (R17)

## Objective
The published `@self-review/react` components export exactly the visible session: replacing the adapter, source or file loads and subscribes to the new session, cancels obsolete work, and clears old comments/viewed/source state (including an empty replacement); same-session updates reconcile without wiping edits; `initialComments` hydrate exactly once after the relevant files exist.

## Skills Required
React context/hooks lifecycle and TypeScript API design.

## Acceptance Criteria
- [x] `ReviewProvider` (`packages/react/src/context/ReviewContext.tsx:159–178,234–295`) re-runs load/subscribe when the adapter identity changes, ignores results from the previous adapter (cancellation token/generation counter), and resets comments/viewed/source state for the new session.
- [x] A pushed wholesale diff for a different session (including an empty file list) replaces exported state — no comments/viewed entries from the old session remain. A same-session update (same source identity) preserves comments/viewed state. Define "session identity" explicitly (e.g. adapter identity + `DiffLoadPayload.source`/`gitDiffArgs`/`repository`/`remote.url`) and document it in the component's JSDoc.
- [x] `SingleFileReview` (`packages/react/src/SingleFileReview.tsx:99–123`) keeps the displayed path and provider state aligned: changing the `file` prop starts a fresh session for that file (e.g. keyed provider), so comments/viewed toggles apply to the visible file and export uses the new source.
- [x] `initialComments` hydrate once, after the files they reference exist; a new array identity with equal content, or after edits, never overwrites subsequent edits. Comments supplied before files arrive are not lost.
- [x] Tests (jsdom) cover: adapter replacement (load called on the new adapter, old files gone), same-name/different-name/empty replacement exports, SingleFileReview file change, initialComments timing and no-overwrite. `npm run test:unit` passes; `npm run typecheck:packages` passes.
- [x] `packages/react/README.md` (if it documents these props) states the semantics; breaking prop changes are allowed but must be reflected in exported types.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/react/src/context/ReviewContext.tsx`, `packages/react/src/hooks/useReviewState.ts`, `packages/react/src/SingleFileReview.tsx`, `packages/react/src/ReviewPanel.tsx` if props change, `src/renderer/App.tsx` and `packages/serve/src/client/index.tsx` only if prop contracts change.
- No `localStorage`; all state stays in React context.

## Input Dependencies
None.

## Output Artifacts
Stable session boundary (task 9 builds lazy-loading cancellation on the same replacement semantics).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R17 and `docs/codebase-audit-2026-10-01/ui.probe.test.tsx` (provider replacement probe) and reproduce first.
2. Simplest robust design: compute a `sessionKey` from adapter identity (WeakMap → incrementing id) and source identity; render the inner provider with `key={sessionKey}` so React discards all state on replacement. Same-session pushes go through a reconcile path that merges files but keeps comments/viewed for paths still present.
3. Desktop currently pushes a diff only from the empty welcome screen; serve shares one diff. Make sure both still work (`npm run test:e2e`).
4. initialComments: store a `hydratedRef` per session key; apply once when `files.length > 0` or when files have loaded (also handle the "no files" session explicitly).
5. Concurrency: tasks 5 and 7 edit other React files in parallel. Edit only the listed files; re-read before editing; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (mount providers with fake adapters). Test state transitions and data integrity; no tests for React itself.
</details>
