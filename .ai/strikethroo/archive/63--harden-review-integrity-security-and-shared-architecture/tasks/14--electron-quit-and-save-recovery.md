---
id: 14
group: "desktop-lifecycle"
dependencies: [10]
status: "completed"
created: 2026-10-01
skills:
  - electron
  - typescript
complexity_score: 6
complexity_notes: "Electron quit/close/save state machine with native menu paths; needs packaged-Electron e2e evidence."
execution_profile: "complex-architecture"
---
# Make desktop quit and save recoverable (R01 desktop, simplification 8)

## Objective
Menu Quit / Cmd+Q / Ctrl+Q follow the same Save & Quit / Discard / Cancel workflow as the window close button; Save & Quit (and Finish Review) close only after `publishReview` succeeds; any serialization/publication failure keeps the window and live review open and shows an actionable error; a missing renderer response is an error, never an empty review written to disk. The destructive pull-save fallback and its polling are removed.

## Skills Required
Electron main-process lifecycle/IPC and TypeScript.

## Acceptance Criteria
- [x] A single explicit close/quit state machine in `src/main/main.ts` (and `menu.ts`): `before-quit` from a user Quit with a review window open is intercepted (`event.preventDefault()`) and routed through `app:close-requested`; only Discard or a successful save sets the "allowed to quit" state. The welcome screen (no review) still quits directly.
- [x] Save paths (`app:save-and-quit`, Finish Review, `review:submit` flows in `ipc-handlers.ts:321–329` and `main.ts:432–472`) call core `publishReview` with `outputOrigin` from the session (explicit when the reviewer chose it via CLI flag or save dialog, inherited when it came from project config/default — task 21 finalizes the provenance plumbing; use `'explicit'` for dialog-chosen paths and the session's recorded origin otherwise). On `ReviewPublishError`, the process does not exit: show a native error dialog (`dialog.showMessageBox`) with the error message and code, keep the review window, and let the reviewer retry or change the output path (existing `output-path:change`).
- [x] The renderer-request timeout path no longer constructs an empty `ReviewState`; the pull fallback and its polling interval are deleted if the state-push contract makes them unnecessary (verify: every save path receives pushed state first). If a timeout remains, it reports an error and writes nothing.
- [x] Startup writability check (parent-dir-only) is replaced by the publisher's error reporting or made consistent with it.
- [x] `src/main/xml-serializer.ts` (if it just re-exports core) and any now-unused main-process write helpers are removed or reduced.
- [x] Electron e2e (`e2e/` electron project): scenarios for (a) menu Quit with comments → confirmation dialog appears, Cancel keeps the session; (b) Save & Quit with output path that is a directory → error shown, app still running, comments still present, previous output unchanged; then fix path and Save & Quit succeeds; (c) Discard quits without writing. Run `npm run test:e2e:electron` — all scenarios pass.
- [x] Unit tests for the state machine where it is extractable (pure reducer or small class in `src/main/`); `npm run test:unit`, `npm run typecheck` pass.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Files: `src/main/main.ts`, `src/main/menu.ts`, `src/main/ipc-handlers.ts` (save/submit handlers only), `src/main/fs-utils.ts`/`src/main/xml-serializer.ts` cleanup, `src/renderer/components/CloseConfirmDialog.tsx` and `src/renderer/App.tsx` if the renderer needs an error/retry state, `src/preload/preload.ts` + `src/shared/ipc-channels.ts` if a new `app:save-failed` channel is needed (document it in AGENTS.md IPC table later — task 24), Electron e2e features/steps.

## Input Dependencies
Task 10 (`publishReview`, `ReviewPublishError`).

## Output Artifacts
Desktop close/save state machine (task 21 later threads output provenance through the same code; task 22 adds remote cleanup timing in `main.ts`).

## Implementation Notes
<details>
<summary>Detailed guidance</summary>

1. Read `docs/codebase-audit-2026-10-01.md` R01 and the "Finish Review = save" convention in AGENTS.md. Audit locations: `main.ts:130,432,443–462`, `menu.ts`, `ipc-handlers.ts:321–329`.
2. Typical Electron pattern: `app.on('before-quit', e => { if (!quitAllowed && reviewWindowOpen) { e.preventDefault(); win.webContents.send(APP_CLOSE_REQUESTED) } })`. Make sure macOS `window-all-closed`/`activate` behavior still works.
3. When the renderer reports a save failure path, it must stay in the review (not show a blank/closing state). If the renderer currently assumes the app exits after Save & Quit, add a failure IPC message so the dialog closes and an error toast/alert appears (shadcn alert-dialog).
4. Electron e2e: see existing features under `e2e/` (find with `ls e2e`), playwright electron config, and `npm run test:e2e:electron` (packages first; takes ~90s). Use a temp dir output path that is a directory to force EISDIR.
5. Concurrency: tasks 11 (apply handler in `ipc-handlers.ts`), 15 (serve) and 16 (remote/forge) run in the same phase. Keep `ipc-handlers.ts` edits to save/submit handlers; re-read before editing; never revert others' work or unrelated uncommitted files. Do not commit. Run `npx prettier --write` on touched files.

Test philosophy: write a few tests, mostly integration (packaged Electron e2e for native close/menu behavior). Test the critical save/quit workflow; skip trivial wiring.
</details>
