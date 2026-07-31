---
id: 2
group: "large-payload-guard"
dependencies: [1]
status: "completed"
created: "2026-03-04"
skills:
  - nodejs
  - electron
---
# Payload Sizing Utility and Guard Dialog

## Objective
Implement the shared `estimatePayloadSize` utility that computes file count and total line count for
both git and directory modes, and wire it into `main.ts` to show an Electron native confirmation
dialog when thresholds are exceeded. Selecting Cancel exits the app; selecting Continue enters
large-payload mode.

## Skills Required
- nodejs: Git command execution (`git diff --numstat`), filesystem operations, line counting
- electron: Native dialog integration (`dialog.showMessageBox`), app lifecycle control

## Acceptance Criteria
- [ ] A new module `src/main/payload-sizing.ts` exports `estimatePayloadSize(files, config): PayloadStats`
- [ ] For git mode: uses `git diff --numstat` to get file count + changed line counts; adds untracked file line counts
- [ ] For directory mode: counts eligible files and their lines without retaining file content
- [ ] Short-circuits counting as soon as either threshold is exceeded (optimization)
- [ ] `main.ts` calls `estimatePayloadSize` before sending diff data to renderer
- [ ] When `exceedsAny` is true, shows Electron `dialog.showMessageBox` with observed values and thresholds
- [ ] Dialog has two buttons: "Continue" (enters large-payload mode) and "Cancel" (exits app)
- [ ] Cancel calls `app.quit()` cleanly
- [ ] Continue sets `isLargePayload: true` on the `DiffLoadPayload`
- [ ] When `maxFiles` or `maxTotalLines` is `0`, that dimension is disabled
- [ ] When both are `0`, no guard dialog is shown
- [ ] Guard works for all launch modes: git CLI, directory CLI, and welcome-screen directory start
- [ ] Unit tests cover: below threshold, above file threshold, above line threshold, both exceeded, disabled dimensions, short-circuit behavior

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- For git mode, run `git diff --numstat` with the same args as the main diff to get stats cheaply
- For directory mode, count files from the scan result and sum line counts
- Use `dialog.showMessageBox` (synchronous-style, modal to BrowserWindow) for the guard dialog
- Dialog message format: "This review contains {fileCount} files and approximately {totalLines} lines.\nThresholds: {maxFiles} files, {maxTotalLines} lines.\n\nLarge reviews may be slow. Continue?"
- The guard runs BEFORE `setDiffData()` / `sendDiffLoad()` to prevent large payloads crossing IPC

## Input Dependencies
- Task 01: `PayloadStats` type, `AppConfig.maxFiles`, `AppConfig.maxTotalLines`, `DiffLoadPayload.isLargePayload`

## Output Artifacts
- `src/main/payload-sizing.ts` — sizing utility module
- Updated `src/main/main.ts` — guard integration in startup flow
- Unit tests for `payload-sizing.ts`
