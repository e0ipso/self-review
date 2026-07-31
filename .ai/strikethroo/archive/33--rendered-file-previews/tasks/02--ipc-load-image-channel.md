---
id: 2
group: infrastructure
dependencies:
  - 1
status: completed
created: '2026-03-09'
skills:
  - typescript
  - electron
---
# Add diff:load-image IPC Channel (Constants, Types, Preload, Main Handler)

## Objective
Wire up the full `diff:load-image` IPC channel: add the channel constant, a response type, extend the preload bridge, and implement the main-process handler that reads a file from disk and returns a base64 data URI.

## Skills Required
- TypeScript — type definitions and interface extension
- Electron — IPC main handler, preload contextBridge, `fs.readFile`, `Buffer`

## Acceptance Criteria
- [ ] `IPC.DIFF_LOAD_IMAGE` constant added to `src/shared/ipc-channels.ts`
- [ ] `ImageLoadResult` type (success `{ dataUri: string }` or error `{ error: string }`) added to `src/shared/types.ts` and the `ElectronAPI` interface updated with `loadImage(filePath: string): Promise<ImageLoadResult>`
- [ ] `preload.ts` exposes `loadImage` via `contextBridge`
- [ ] Main process handler in `ipc-handlers.ts` reads the file, detects MIME type, encodes as base64 data URI, and returns the result
- [ ] Handler supports both absolute paths (directory mode) and relative paths (git mode, resolved against CWD)
- [ ] Files larger than 10 MB return `{ error: 'File too large to preview (>10 MB)' }` instead of loading
- [ ] File not found returns `{ error: 'Image preview unavailable — file not found on disk.' }`

## Technical Requirements
- Channel constant: `DIFF_LOAD_IMAGE: 'diff:load-image'`
- MIME type mapping (no external library):
  - `.jpg`/`.jpeg` → `image/jpeg`
  - `.png` → `image/png`
  - `.gif` → `image/gif`
  - `.webp` → `image/webp`
  - `.ico` → `image/x-icon`
  - `.bmp` → `image/bmp`
  - `.svg` → `image/svg+xml`
- Use `fs.readFile` and `Buffer.from(data).toString('base64')`
- Data URI format: `data:{mimeType};base64,{base64data}`
- Use `fs.stat` to check file size before reading
- Path resolution: `path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath)`

## Input Dependencies
- Task 01 is not strictly required here, but the MIME extension list must match the extensions from `isPreviewableImage` + `isPreviewableSvg`

## Output Artifacts
- Updated `src/shared/ipc-channels.ts`
- Updated `src/shared/types.ts` (`ImageLoadResult` type + `ElectronAPI.loadImage`)
- Updated `src/preload/preload.ts`
- Updated `src/main/ipc-handlers.ts`

## Implementation Notes

<details>
<summary>Implementation details</summary>

### ipc-channels.ts
Add to the `IPC` object:
```ts
DIFF_LOAD_IMAGE: 'diff:load-image',
```

### types.ts
Add after existing types:
```ts
export type ImageLoadResult = { dataUri: string } | { error: string };
```

Update `ElectronAPI` interface:
```ts
loadImage: (filePath: string) => Promise<ImageLoadResult>;
```

### preload.ts
Inside the `contextBridge.exposeInMainWorld` call, add:
```ts
loadImage: (filePath: string) =>
  ipcRenderer.invoke(IPC.DIFF_LOAD_IMAGE, filePath),
```

### ipc-handlers.ts
Add a handler (alongside existing handlers):
```ts
ipcMain.handle(IPC.DIFF_LOAD_IMAGE, async (_event, filePath: string): Promise<ImageLoadResult> => {
  const MIME_MAP: Record<string, string> = {
    '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png',
    '.gif': 'image/gif', '.webp': 'image/webp', '.ico': 'image/x-icon',
    '.bmp': 'image/bmp', '.svg': 'image/svg+xml',
  };
  const MAX_SIZE = 10 * 1024 * 1024; // 10 MB
  const resolved = path.isAbsolute(filePath) ? filePath : path.resolve(process.cwd(), filePath);
  const ext = path.extname(filePath).toLowerCase();
  const mimeType = MIME_MAP[ext] ?? 'application/octet-stream';

  try {
    const stat = await fs.promises.stat(resolved);
    if (stat.size > MAX_SIZE) {
      return { error: 'File too large to preview (>10 MB)' };
    }
    const data = await fs.promises.readFile(resolved);
    return { dataUri: `data:${mimeType};base64,${data.toString('base64')}` };
  } catch {
    return { error: 'Image preview unavailable — file not found on disk.' };
  }
});
```

Make sure `path` and `fs` are already imported in `ipc-handlers.ts`; add imports if missing.
Use `console.error()` for any unexpected errors (not `console.log()`).
</details>
