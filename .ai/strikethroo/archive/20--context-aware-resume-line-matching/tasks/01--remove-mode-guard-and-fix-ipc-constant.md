---
id: 1
group: "resume-from-fix"
dependencies: []
status: "completed"
created: 2026-02-25
skills:
  - typescript
---

# Remove Mode Guard and Fix IPC Channel Constant

## Objective

Remove the `mode === 'git'` guard that silently discards `--resume-from` in non-git sessions, and move the `resume:request` raw string literal into the shared `IPC` constants object to eliminate drift.

## Skills Required

TypeScript, Node.js Electron main-process code.

## Acceptance Criteria

- [ ] `main.ts` Phase 5 processes `--resume-from` in all session modes (git, file, directory, welcome)
- [ ] The guard reads `if (cliArgs.resumeFrom)` with no `mode` check
- [ ] `IPC_CHANNELS.ts` (or `ipc-channels.ts`) exports a `RESUME_REQUEST` (or equivalent) constant
- [ ] `ipc-handlers.ts` uses the constant instead of a raw `'resume:request'` string literal
- [ ] `preload.ts` uses the constant instead of a raw `'resume:request'` string literal
- [ ] All existing unit tests pass

## Technical Requirements

- File: `src/main/main.ts` — change the condition on the resume-from block
- File: `src/shared/ipc-channels.ts` — add `RESUME_REQUEST` (or `resume:request`) to the `IPC` object
- File: `src/main/ipc-handlers.ts` — replace raw string with imported constant
- File: `src/preload/preload.ts` — replace raw string with imported constant

## Input Dependencies

None — this is the first task.

## Output Artifacts

- Modified `src/main/main.ts` with mode guard removed
- Modified `src/shared/ipc-channels.ts` with new constant
- Modified `src/main/ipc-handlers.ts` using constant
- Modified `src/preload/preload.ts` using constant

## Implementation Notes

<details>
<summary>Detailed instructions</summary>

### Step 1 — Locate the mode guard

In `src/main/main.ts`, search for the Phase 5 block. It will look roughly like:

```typescript
if (cliArgs.resumeFrom && mode === 'git') {
  // parse XML and call setResumeComments(...)
}
```

Change it to:

```typescript
if (cliArgs.resumeFrom) {
  // parse XML and call setResumeComments(...)
}
```

Do not change anything inside the block — just remove `&& mode === 'git'`.

### Step 2 — Add constant to ipc-channels.ts

Open `src/shared/ipc-channels.ts`. It exports an `IPC` object (or similar constant map). Add:

```typescript
RESUME_REQUEST: 'resume:request',
```

alongside the other existing channel names. Keep the same style/format as the surrounding entries.

### Step 3 — Update ipc-handlers.ts

Find the raw string `'resume:request'` in `src/main/ipc-handlers.ts` and replace it with the imported constant (`IPC.RESUME_REQUEST` or whatever naming the file uses). Import from `src/shared/ipc-channels.ts` if not already imported.

### Step 4 — Update preload.ts

Same as Step 3 but in `src/preload/preload.ts`. The preload script uses `ipcRenderer.on('resume:request', ...)` or similar — replace with the constant.

### Verification

Run `npm run test:unit` and confirm no test regressions. The change is minimal — one condition line plus three string replacements — so no behavioral changes are expected in existing tests.

</details>
