---
id: 1
group: "large-payload-guard"
dependencies: []
status: "completed"
created: "2026-03-04"
skills:
  - typescript
  - electron-ipc
---
# Foundation — Types, Config, IPC Channels, and Preload Bridge

## Objective
Add all foundational type definitions, configuration keys, IPC channel constants, and preload bridge
methods needed by the large payload guard feature. This task creates the contract that all
subsequent tasks depend on.

## Skills Required
- typescript: Extending shared type interfaces and ensuring type safety across process boundaries
- electron-ipc: Adding IPC channel constants and preload bridge wiring

## Acceptance Criteria
- [ ] `AppConfig` in `src/shared/types.ts` includes `maxFiles: number` (default `500`) and `maxTotalLines: number` (default `100000`)
- [ ] `DiffFile` in `src/shared/types.ts` has an optional `contentLoaded?: boolean` field
- [ ] `DiffLoadPayload` in `src/shared/types.ts` has an optional `isLargePayload?: boolean` field
- [ ] A new `PayloadStats` interface exists in `src/shared/types.ts` with `{ fileCount: number; totalLines: number; exceedsFiles: boolean; exceedsLines: boolean; exceedsAny: boolean }`
- [ ] `ElectronAPI` in `src/shared/types.ts` includes `loadFileContent(filePath: string): Promise<DiffHunk[]>`
- [ ] `src/shared/ipc-channels.ts` has new channel constants: `DIFF_LOAD_FILE` and `PAYLOAD_GUARD_SHOW`
- [ ] `src/main/config.ts` default config includes `maxFiles: 500` and `maxTotalLines: 100000`
- [ ] `src/main/config.ts` YAML mapping handles `max-files` → `maxFiles` and `max-total-lines` → `maxTotalLines`
- [ ] Config validation rejects negative values for both threshold fields
- [ ] `src/preload/preload.ts` exposes `loadFileContent` using `ipcRenderer.invoke(IPC.DIFF_LOAD_FILE, filePath)`
- [ ] All existing unit tests still pass

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Follow existing patterns in `types.ts` for interface extension
- Follow existing patterns in `config.ts` for YAML key mapping (see `loadYamlConfig()`)
- Follow existing `expandContext` pattern in preload for the new invoke method
- `0` disables that specific guard dimension (per plan clarification)

## Input Dependencies
None — first task.

## Output Artifacts
- Updated `src/shared/types.ts` with new/extended interfaces
- Updated `src/shared/ipc-channels.ts` with new channel constants
- Updated `src/main/config.ts` with new defaults and YAML mapping
- Updated `src/preload/preload.ts` with new bridge method
