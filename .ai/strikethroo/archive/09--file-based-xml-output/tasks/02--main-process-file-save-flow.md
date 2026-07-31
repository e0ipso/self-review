---
id: 2
group: 'main-process'
dependencies: [1]
status: 'completed'
created: '2026-02-12'
skills:
  - typescript
  - electron
---

# Restructure main process close handler to write XML to file

## Objective

Replace the stdout-based XML output with file-based output. Restructure the window close handler to support two distinct exit paths: save-and-quit (writes file) and discard-and-quit (exits without writing). The close handler intercepts native close events and delegates to the renderer for decision-making.

## Skills Required

TypeScript for Node.js file I/O. Electron lifecycle management (`BrowserWindow.on('close')`, `event.preventDefault()`, `mainWindow.destroy()`).

## Acceptance Criteria

- [ ] `mainWindow.on('close')` calls `event.preventDefault()` and sends `app:close-requested` to renderer
- [ ] `app:save-and-quit` IPC handler: requests ReviewState from renderer, serializes to XML, writes to `appConfig.outputFile` (resolved relative to `process.cwd()`), logs path to stderr, destroys window, exits 0
- [ ] `app:discard-and-quit` IPC handler: destroys window, exits 0 without writing any file
- [ ] `fs.writeFileSync` errors are caught, logged to stderr, and exit with code 1
- [ ] No output is written to stdout under any circumstances
- [ ] Existing `requestReviewFromRenderer` function is reused for the review state retrieval
- [ ] All existing unit tests still pass

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Node.js `fs.writeFileSync`, `path.resolve`
- Electron `ipcMain.on`, `BrowserWindow.webContents.send`, `mainWindow.destroy()`
- Existing `requestReviewFromRenderer` from `ipc-handlers.ts`
- Existing `serializeReview` from `xml-serializer.ts`

## Input Dependencies

- Task 1: `AppConfig.outputFile` field, new IPC channel constants, preload bridge methods

## Output Artifacts

- Updated `src/main/main.ts` (restructured close handler, new IPC listeners)
- Possibly updated `src/main/ipc-handlers.ts` (if IPC registration moves there)

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### Changes to `src/main/main.ts`

#### 1. Add imports

Add `writeFileSync` and `resolve` imports at the top:

```typescript
import { writeFileSync } from 'fs';
import { resolve } from 'path';
```

Import the new IPC constants from `ipc-channels.ts`:

```typescript
import { IPC } from '../shared/ipc-channels';
```

(IPC may already be imported indirectly via ipc-handlers — check and add if needed.)

#### 2. Replace the `mainWindow.on('close')` handler

The current handler (lines ~238-279 in main.ts) does:
1. `event.preventDefault()`
2. Request review state
3. Serialize to XML
4. `process.stdout.write(xml)`
5. Destroy window + exit

Replace with a simple handler that only intercepts and notifies the renderer:

```typescript
mainWindow.on('close', (event) => {
  if (!mainWindow) return;
  event.preventDefault();
  mainWindow.webContents.send(IPC.APP_CLOSE_REQUESTED);
});
```

#### 3. Add `app:save-and-quit` IPC handler

Register this after `registerIpcHandlers()` is called (or inside a new registration block). Use `ipcMain.on`:

```typescript
ipcMain.on(IPC.APP_SAVE_AND_QUIT, async () => {
  if (!mainWindow) return;

  try {
    console.error('[main] Save and quit requested');
    const reviewState = await requestReviewFromRenderer(mainWindow);
    const xml = await serializeReview(reviewState);

    const outputPath = resolve(process.cwd(), appConfig!.outputFile);
    writeFileSync(outputPath, xml + '\n', 'utf-8');
    console.error(`[main] Review written to ${outputPath}`);

    mainWindow.destroy();
    process.exit(0);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`[main] Error saving review: ${error.message}`);
    } else {
      console.error('[main] Error saving review: unknown error');
    }
    process.exit(1);
  }
});
```

#### 4. Add `app:discard-and-quit` IPC handler

```typescript
ipcMain.on(IPC.APP_DISCARD_AND_QUIT, () => {
  console.error('[main] Discard and quit requested');
  if (mainWindow) {
    mainWindow.destroy();
  }
  process.exit(0);
});
```

#### 5. Import `ipcMain` if not already imported

Check the existing imports at the top of `main.ts`. `ipcMain` is likely not imported there since IPC registration is delegated to `ipc-handlers.ts`. Add it:

```typescript
import { app, BrowserWindow, ipcMain } from 'electron';
```

#### 6. Remove stdout write

Delete the entire `process.stdout.write(xml + '\n', () => { ... })` block from the old close handler (this block is being replaced by the new IPC handlers above).

### Important considerations

- The `appConfig` variable is declared at module scope (line ~87) and set during `initializeApp()`. The IPC handlers can safely access it via closure since they're registered after init.
- The `mainWindow` variable is also module-scoped. The null checks (`if (!mainWindow)`) are needed for TypeScript narrowing and edge cases.
- `requestReviewFromRenderer` already handles timeouts (5 seconds) and returns a fallback empty review state. This behavior is preserved.
- The `serializeReview` function validates against the XSD. If validation fails, it throws — which is caught by the try/catch and triggers exit(1).

### Testing

Run existing unit tests to verify nothing breaks:
```bash
npm run test:unit:main
```

Manual verification requires running the Electron app (E2E tests cover this in Task 5).

</details>
