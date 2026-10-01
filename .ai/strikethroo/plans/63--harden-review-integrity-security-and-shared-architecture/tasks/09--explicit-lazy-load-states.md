---
id: 9
group: "react-loading"
dependencies: [5, 6]
status: "completed"
created: 2026-10-01
skills:
  - react
  - typescript
complexity_score: 4
execution_profile: "standard-implementation"
---
# Give lazy file loads explicit recoverable states and bound large-mode expansion (R14 UI)

## Objective
Lazy file content uses explicit idle/loading/loaded/error states; a failed request stops until the reviewer clicks Retry; unmount/session replacement invalidates outstanding results; large mode (triggered by file count or total line count) does not start with every file expanded and fetching.

## Skills Required
React hooks/effects and TypeScript.

## Acceptance Criteria
- [x] `FileSection.tsx:68–89` lazy-load effect guards on the error state; a rejected load sets `error` and makes no further request until user-directed Retry. Test: a persistently rejecting adapter is called exactly once until Retry is clicked, then once more.
- [x] Results arriving after unmount or after the session/file was replaced are ignored (generation token); test with a deferred promise resolved after unmount/replacement.
- [x] Initial expansion is based on payload mode (`isLargePayload`), not just file count (`DiffViewer.tsx:31`): in line-count-triggered large mode with ≤50 files, files start collapsed and no content requests are issued until a file is expanded/navigated to. Test with a large-mode payload of a few files.
- [x] Error UI shows a Retry button (shadcn `Button`) and an actionable message.
- [x] `npm run test:unit` and `npm run test:e2e` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/react/src/components/DiffViewer/FileSection.tsx`, `DiffViewer.tsx`, `DiffContentArea.tsx` (error/retry display), possibly `ReviewContext.tsx` if lazy state lives there.

## Input Dependencies
Task 5 (safe lookups/boundary in `FileSection.tsx`), task 6 (session replacement semantics to hook cancellation into).

## Output Artifacts
Explicit lazy-load state machine.

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R14 (UI part) and the retry probe in `docs/codebase-audit-2026-10-01/ui.probe.test.tsx`.
2. State: `type LoadState = { kind: 'idle' } | { kind: 'loading'; gen: number } | { kind: 'loaded' } | { kind: 'error'; message: string }`. Effect triggers only from `idle` when expanded/visible.
3. Concurrency: tasks 3 and 8 run in the same phase; task 8 may touch `FileSection.tsx`/`DiffContentArea.tsx` lines that build Markdown component props. Re-read before each edit, keep your edits to the lazy-load and expansion logic; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (jsdom with fake adapters). Test state transitions; skip trivial rendering.
</details>
