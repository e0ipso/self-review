---
id: 1
group: "serve-mode"
dependencies: []
status: "completed"
created: 2026-08-28
skills:
  - typescript-refactoring
  - electron
complexity_score: 7
complexity_notes: "Refactor of live desktop code with startup-ordering implications; wide blast radius across the Electron main process."
execution_profile: "complex-architecture"
---
# Extract transport-agnostic handler logic out of the Electron IPC layer

## Objective
Move the transport-agnostic bodies of the Electron IPC handlers into a module that
takes plain arguments and returns plain results, leaving the `ipcMain` registrations as thin
adapters over it, so the HTTP routes added later call the same implementation rather than a copy.

## Skills Required
`typescript-refactoring` to lift logic without behaviour change, and `electron` to
understand what the `ipcMain` registrations and the main-process startup sequence guarantee.

## Acceptance Criteria
- [ ] A new module exports handler functions for diff loading, resume loading, review submission, context expansion, per-file content loading, image loading, and attachment reading.
- [ ] The extracted functions take their inputs as explicit arguments and return values; none of them import `electron` or read module-level Electron state.
- [ ] Startup-populated state (diff payload, guide payload, resume data) is supplied to the module explicitly rather than read from ambient module-level caches.
- [ ] `src/main/ipc-handlers.ts` registrations delegate to the extracted module and contain no duplicated logic.
- [ ] Electron-only handlers (dialogs, window lifecycle, find-in-page, external links, version updates) are NOT extracted and remain in place.
- [ ] Runnable: `npm run test:unit` passes.
- [ ] Runnable: `npm run test:e2e:electron` passes, proving the desktop app is behaviourally unchanged.
- [ ] Runnable: `git diff --stat packages/` is empty — no package under `packages/` is modified by this task.

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
TypeScript. The handlers currently registered in `src/main/ipc-handlers.ts` via `ipcMain.on`
and `ipcMain.handle`. Existing helpers such as `preparePayload` and the large-payload path stay in
use and are not reimplemented. `@self-review/core` continues to own git, filesystem and XML work.

## Input Dependencies
None. This is the first task and depends only on the repository as it stands.

## Output Artifacts
A transport-agnostic handler module consumed by `src/main/ipc-handlers.ts` in this task
and by the HTTP routes in task 3.

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

Read `src/main/ipc-handlers.ts` end to end before changing anything. Note which
registrations are `ipcMain.on` (fire-and-forget, reply via `event.sender.send`) and which are
`ipcMain.handle` (request/response). The `on` handlers must become functions that RETURN their
payload rather than sending it; the registration is then responsible for the sending.

Pay particular attention to `IPC.DIFF_REQUEST`. It sends `IPC.DIFF_LOAD` and then conditionally
sends `IPC.GUIDE_LOAD` from `guideDataCache`. The extracted function should return both the diff
payload and the guide (or null) together, because task 3 needs to serve them in one HTTP response.

The module-level caches (`diffDataCache`, `guideDataCache`, resume/remote-drift caches) are the
crux of this task. Today they are populated by Electron startup and read ambiently. Give the
extracted module an explicit way to receive that state — a context object passed in, or an
initializer the caller invokes — so that the HTTP server can populate it during its own startup.
Do not leave the module reading a shared mutable import; that is exactly the coupling this
extraction exists to remove.

Do NOT change behaviour. This task should be reviewable as a pure move: same inputs, same outputs,
same ordering. Verify with `npm run test:e2e:electron` before considering it done. If a behavioural
change seems necessary to make the extraction work, stop and surface it rather than absorbing it
silently.

Leave Electron-only concerns alone: `DIALOG_PICK_DIRECTORY`, the `APP_*` lifecycle channels, the
`FIND_*` channels, `VERSION_UPDATE_*`, `APP_SHOW_ABOUT`, `OPEN_EXTERNAL`, `REMOTE_OPEN_URL`. They
have no serve-mode equivalent and moving them adds risk for no benefit.

</details>
