---
id: 1
group: 'output-path-indicator'
dependencies: []
status: 'completed'
created: '2026-02-27'
skills:
  - electron-ipc
  - typescript
---

# Add IPC Channels, Types, Writability Check, and Save Dialog Handler

## Objective

Add the IPC infrastructure and main process logic to support a mutable output path with writability validation and a native save dialog. This is the foundational task that all renderer work depends on.

## Skills Required

- electron-ipc: Main process IPC handlers, `dialog.showSaveDialog`
- typescript: Type definitions, shared contracts

## Acceptance Criteria

- [ ] `src/shared/types.ts` has new `OutputPathInfo` type with `resolvedOutputPath: string` and `outputPathWritable: boolean`
- [ ] `src/shared/types.ts` `ElectronAPI` interface includes `changeOutputPath(): Promise<OutputPathInfo | null>` and `onOutputPathChanged(callback: (info: OutputPathInfo) => void): void`
- [ ] `src/shared/ipc-channels.ts` has `OUTPUT_PATH_CHANGE: 'output-path:change'` and `OUTPUT_PATH_CHANGED: 'output-path:changed'` channels
- [ ] Main process initializes a mutable `currentOutputPath` variable resolved from config on startup
- [ ] Main process checks writability of the output path's parent directory via `fs.accessSync(dir, fs.constants.W_OK)`
- [ ] Main process sends `resolvedOutputPath` and `outputPathWritable` along with config on `config:load`
- [ ] New `output-path:change` invoke handler opens `dialog.showSaveDialog()` and returns `OutputPathInfo | null`
- [ ] Main process updates `currentOutputPath` when user selects a new path
- [ ] Existing save handler in `main.ts` uses `currentOutputPath` instead of re-resolving from config
- [ ] `src/preload/preload.ts` exposes `changeOutputPath()` and `onOutputPathChanged()` via contextBridge

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Node.js `fs.accessSync` with `fs.constants.W_OK` for writability check
- Electron `dialog.showSaveDialog` for native file picker
- Electron `ipcMain.handle` for the invoke pattern (request/response)
- Extend existing `config:load` payload to include output path info

## Input Dependencies

None — this is the foundational task.

## Output Artifacts

- Updated `src/shared/types.ts` with `OutputPathInfo` type and updated `ElectronAPI`
- Updated `src/shared/ipc-channels.ts` with new channel constants
- Updated `src/main/main.ts` with mutable output path state, writability check, and updated save handler
- Updated `src/main/ipc-handlers.ts` with `output-path:change` handler
- Updated `src/preload/preload.ts` with new API methods

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### 1. Types (`src/shared/types.ts`)

Add a new interface:
```typescript
export interface OutputPathInfo {
  resolvedOutputPath: string;
  outputPathWritable: boolean;
}
```

Add to `ElectronAPI` interface:
```typescript
changeOutputPath(): Promise<OutputPathInfo | null>;
onOutputPathChanged(callback: (info: OutputPathInfo) => void): void;
```

### 2. IPC Channels (`src/shared/ipc-channels.ts`)

Add to the `IPC` object:
```typescript
OUTPUT_PATH_CHANGE: 'output-path:change',
OUTPUT_PATH_CHANGED: 'output-path:changed',
```

### 3. Main Process (`src/main/main.ts`)

Add a mutable variable alongside existing globals:
```typescript
let currentOutputPath: string = '';
let outputPathWritable: boolean = false;
```

Create a writability check helper:
```typescript
function checkWritability(filePath: string): boolean {
  try {
    const dir = path.dirname(filePath);
    fs.accessSync(dir, fs.constants.W_OK);
    return true;
  } catch {
    return false;
  }
}
```

In `initializeApp()` (after config is loaded), resolve and check:
```typescript
currentOutputPath = resolve(process.cwd(), appConfig.outputFile);
outputPathWritable = checkWritability(currentOutputPath);
```

When sending config to renderer (in `config:load`), include:
```typescript
event.sender.send(IPC.CONFIG_LOAD, appConfig, { resolvedOutputPath: currentOutputPath, outputPathWritable });
```

Or send as a combined payload. Match the existing pattern for how config is sent.

Update the save handler to use `currentOutputPath` instead of `resolve(process.cwd(), appConfig!.outputFile)`.

### 4. IPC Handler for Save Dialog (`src/main/ipc-handlers.ts` or `src/main/main.ts`)

Use `ipcMain.handle` for the invoke pattern:
```typescript
ipcMain.handle(IPC.OUTPUT_PATH_CHANGE, async () => {
  const result = await dialog.showSaveDialog(mainWindow!, {
    title: 'Save Review As',
    defaultPath: currentOutputPath,
    filters: [{ name: 'XML Files', extensions: ['xml'] }],
  });
  if (result.canceled || !result.filePath) return null;
  currentOutputPath = result.filePath;
  outputPathWritable = checkWritability(currentOutputPath);
  return { resolvedOutputPath: currentOutputPath, outputPathWritable };
});
```

### 5. Preload (`src/preload/preload.ts`)

Add to the exposed API:
```typescript
changeOutputPath: () => ipcRenderer.invoke(IPC.OUTPUT_PATH_CHANGE),
onOutputPathChanged: (callback: (info: OutputPathInfo) => void) =>
  ipcRenderer.on(IPC.OUTPUT_PATH_CHANGED, (_event, info) => callback(info)),
```

### Important Notes

- The `config:load` channel currently sends just `AppConfig`. You need to either extend the payload or send output path info separately. Check the existing pattern in `ipc-handlers.ts` line ~44 and `ConfigContext.tsx` line ~120 to decide the cleanest approach. If extending the payload, update the `onConfigLoad` callback signature.
- The save handler is around line 344 in `main.ts`. Replace `resolve(process.cwd(), appConfig!.outputFile)` with `currentOutputPath`.
- Make sure `dialog` is imported from `electron` in whatever file handles the save dialog.
</details>
