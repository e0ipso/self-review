---
id: 7
group: "react-comments"
dependencies: []
status: "completed"
created: 2026-10-01
skills:
  - react
  - typescript
complexity_score: 5
execution_profile: "standard-implementation"
---
# Fix comment editing integrity and the small confirmed UI defects (R11 UI, R18, R19)

## Objective
Editing a comment persists attachment removal; attachment/image async work cannot leak blob URLs or show stale results; editing an imported suggestion substitutes visible original code only when the whole range is covered; deleted files are searchable; configured `font-size` changes the UI; the `f` hint focuses the opened composer; rejected image requests settle into a visible error.

## Skills Required
React components/hooks and TypeScript.

## Acceptance Criteria
- [x] R11 UI: `CommentInput.tsx:69–74` sends an explicit empty attachment list when the last attachment is removed, so Update clears it (reply editing already does this — reuse its approach).
- [x] R11 UI: `AttachmentImage.tsx:22–37` ignores stale reads (generation/abort flag), revokes any blob URL created after unmount/cancellation, resets error state on new input. Test: unmount during a pending load creates no unreclaimed URL (`URL.createObjectURL`/`revokeObjectURL` spies balanced).
- [x] R18: `packages/react/src/utils/comment-anchors.ts:12–16` and `diff-utils.ts:7–19` require every line of the selected side/range to be present in visible hunks before `CommentInput`/`CommentDisplay` substitute visible code for a suggestion's `originalCode`; otherwise the stored original is kept and the UI marks the anchor as not fully visible. Tests cover old/new sides across a hunk gap and omitted endpoints.
- [x] R19: file-tree search matches deleted files by `newPath || oldPath` (`FileTree.tsx:64`); test deletion lookup.
- [x] R19: configured `font-size` (parsed at `packages/core/src/config.ts:142`) visibly changes the diff/review font size through a stable CSS variable applied at the review root; test that a configured value appears in computed style/inline variable.
- [x] R19: `useKeyboardNavigation.ts:117–122` no longer globally focuses the first textarea; with two open composers, activating an `f` hint focuses the newly opened composer. Test it.
- [x] R19: `RenderedImageView` handles a rejected adapter promise by showing an error state (no spinner forever, no unhandled rejection). Test with a rejecting adapter.
- [x] `npm run test:unit` and `npm run test:e2e` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `packages/react/src/components/Comments/CommentInput.tsx`, `AttachmentImage.tsx`, `CommentDisplay.tsx`, `packages/react/src/utils/comment-anchors.ts`, `packages/react/src/components/DiffViewer/diff-utils.ts`, `packages/react/src/components/FileTree.tsx`, `packages/react/src/hooks/useKeyboardNavigation.ts`, `packages/react/src/components/DiffViewer/RenderedImageView.tsx`, `packages/react/src/context/ConfigContext.tsx`/`Layout.tsx` for font-size.

## Input Dependencies
None.

## Output Artifacts
Font-size wiring in `ConfigContext` (task 23 later consolidates config defaults in the same area).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R11 (UI parts), R18, R19 and the related probes in `docs/codebase-audit-2026-10-01/ui.probe.test.tsx`.
2. Coverage check: given side and `[start,end]`, collect the set of line numbers present on that side across the file's hunks; require every integer in range to be present.
3. Font-size: check `AppConfig` field name in `@self-review/types` and the README configuration section for the documented unit; set `style={{ '--sr-font-size': `${n}px` }}` on the review root and use it in the diff/code CSS (`packages/react/src/styles.css`). Do not move defaults (task 23 owns that).
4. Concurrency: tasks 5 and 6 edit other React files in parallel (`DiffNavigationContext`, `DiffViewer`, `FileSection`, `ReviewContext`, `SingleFileReview`). Edit only the listed files; re-read before editing; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (jsdom component tests). Test edge cases and state integrity; skip trivial behavior.
</details>
