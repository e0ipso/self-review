---
id: 1
group: "foundation"
dependencies: []
status: "completed"
created: "2026-02-16"
skills: ["typescript", "electron-ipc"]
---

# Add Attachment Types, IPC Channel, and Preload Bridge

## Objective

Establish the type contract and IPC plumbing for image attachments. This task creates the foundational layer that all other tasks depend on: the `Attachment` interface, updated `ReviewComment` type, new IPC channel constant, updated preload bridge, and the main-process IPC handler for reading attachment files from disk.

## Skills Required

- `typescript`: Defining interfaces, updating type contracts
- `electron-ipc`: Adding IPC channel, handler, and preload bridge method

## Acceptance Criteria

- [ ] `Attachment` interface added to `src/shared/types.ts` with fields: `id`, `fileName`, `mediaType`, `data` (ArrayBuffer)
- [ ] `ReviewComment` interface in `src/shared/types.ts` gains optional `attachments?: Attachment[]`
- [ ] `attachment:read` channel constant added to `src/shared/ipc-channels.ts`
- [ ] `ElectronAPI` interface in `src/shared/types.ts` updated with `readAttachment(filePath: string): Promise<ArrayBuffer>` method
- [ ] Preload script (`src/preload/preload.ts`) exposes `readAttachment` via `contextBridge`
- [ ] `ipcMain.handle` for `attachment:read` implemented in `src/main/ipc-handlers.ts` — reads the file from disk and returns the buffer
- [ ] TypeScript compiles without errors

## Technical Requirements

- Electron's structured clone algorithm handles `ArrayBuffer` across IPC natively — no manual encoding needed
- The `attachment:read` handler should read the file using `fs.readFile` and return the buffer. If the file does not exist, return `null` (graceful degradation, no throw)
- Channel naming follows existing convention in `ipc-channels.ts`

## Input Dependencies

None — this is the foundation task.

## Output Artifacts

- Updated `src/shared/types.ts` (Attachment interface, updated ReviewComment, updated ElectronAPI)
- Updated `src/shared/ipc-channels.ts` (new channel constant)
- Updated `src/preload/preload.ts` (new exposed method)
- Updated `src/main/ipc-handlers.ts` (new handler)

## Implementation Notes

<details>

### Step 1: Update `src/shared/types.ts`

Add the `Attachment` interface after the existing `Suggestion` interface:

```typescript
export interface Attachment {
  id: string;
  fileName: string;
  mediaType: string;
  data?: ArrayBuffer; // Present in-memory during session, stripped before XML serialization
}
```

Note: `data` is optional because resumed attachments only have the file path reference, not the loaded data.

Update `ReviewComment` to add an optional `attachments` field:

```typescript
export interface ReviewComment {
  // ... existing fields ...
  attachments?: Attachment[];
}
```

Update `ElectronAPI` to add:

```typescript
readAttachment: (filePath: string) => Promise<ArrayBuffer | null>;
```

### Step 2: Update `src/shared/ipc-channels.ts`

Add a new constant following the existing naming pattern:

```typescript
ATTACHMENT_READ: 'attachment:read',
```

### Step 3: Update `src/preload/preload.ts`

In the `contextBridge.exposeInMainWorld` call, add:

```typescript
readAttachment: (filePath: string) => ipcRenderer.invoke(IPC_CHANNELS.ATTACHMENT_READ, filePath),
```

### Step 4: Update `src/main/ipc-handlers.ts`

Add a new `ipcMain.handle` for the attachment read channel:

```typescript
ipcMain.handle(IPC_CHANNELS.ATTACHMENT_READ, async (_event, filePath: string) => {
  try {
    const buffer = await fs.promises.readFile(filePath);
    return buffer.buffer; // Convert Node.js Buffer to ArrayBuffer
  } catch {
    console.error(`[attachment:read] Failed to read file: ${filePath}`);
    return null;
  }
});
```

Important: Return `null` on failure (graceful degradation). Log the warning to stderr via `console.error`.

</details>
