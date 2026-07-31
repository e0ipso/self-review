---
id: 4
group: "large-payload-guard"
dependencies: [1, 2]
status: "completed"
created: "2026-03-04"
skills:
  - electron-ipc
  - react
---
# Lazy Content Loading in Large-Payload Mode

## Objective
Implement on-demand file content loading for large-payload mode. In this mode, the initial IPC
payload contains metadata-only `DiffFile` entries (empty hunks), and expanding a file triggers a
single-file IPC request to load its content. Normal mode retains eager loading.

## Skills Required
- electron-ipc: IPC handler for single-file content requests, payload stripping
- react: Per-file loading state management, on-expand content fetching, loading UI

## Acceptance Criteria
- [ ] In large-payload mode, `diff:load` payload sends `DiffFile[]` with `hunks: []` and `contentLoaded: false`
- [ ] Main process keeps full `DiffFile[]` in `diffDataCache` (including hunks)
- [ ] `ipc-handlers.ts` registers a handler for `IPC.DIFF_LOAD_FILE` that returns hunks for a single file by path
- [ ] The handler uses a stable file identifier (newPath or oldPath) to find the file in cache
- [ ] `FileSection.tsx` detects when `contentLoaded` is false and file is expanded, then calls `electronAPI.loadFileContent(filePath)`
- [ ] While loading, a spinner/loading indicator is shown in place of diff content
- [ ] After loading, file hunks are updated in React state and the file renders normally
- [ ] Per-file load status tracking prevents duplicate in-flight requests (`idle` → `loading` → `loaded` → `error`)
- [ ] Failed loads show an inline error with a retry button
- [ ] In normal mode (non-large), all files have `contentLoaded: true` and hunks populated — no lazy loading path is triggered
- [ ] Existing expand-context functionality continues to work in both modes
- [ ] Unit tests for the IPC handler (file found, file not found)
- [ ] Unit tests for the loading state management in the renderer

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- In `ipc-handlers.ts`, when `isLargePayload` is true, strip hunks from `DiffFile[]` before sending via `diff:load`
- Add `ipcMain.handle(IPC.DIFF_LOAD_FILE, ...)` handler that looks up the file in `diffDataCache` and returns its hunks
- In `FileSection.tsx`, add a `useEffect` or callback that fires when `expanded` becomes true and `file.contentLoaded` is false
- Use `electronAPI.loadFileContent(filePath)` (wired in Task 01) to fetch hunks
- Update file state in the parent component or context to merge loaded hunks
- Do NOT keep a full in-memory cache of all hunks in the renderer for large mode — only load what's expanded
- Follow the existing `handleExpandContext` pattern in `FileSection.tsx` for the IPC call structure

## Input Dependencies
- Task 01: `DiffFile.contentLoaded`, `ElectronAPI.loadFileContent`, `IPC.DIFF_LOAD_FILE`, `DiffLoadPayload.isLargePayload`
- Task 02: `isLargePayload` flag set in `main.ts` after guard confirmation

## Output Artifacts
- Updated `src/main/ipc-handlers.ts` — payload stripping + single-file handler
- Updated `src/renderer/components/DiffViewer/FileSection.tsx` — on-expand loading
- Updated `src/renderer/components/DiffViewer/DiffViewer.tsx` — file state update callback
- Loading indicator component or inline UI
- Unit tests for IPC handler and loading state
