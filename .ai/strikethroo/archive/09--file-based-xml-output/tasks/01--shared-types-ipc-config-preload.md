---
id: 1
group: 'foundation'
dependencies: []
status: 'completed'
created: '2026-02-12'
skills:
  - typescript
  - electron
---

# Add outputFile to shared types, IPC channels, config layer, and preload bridge

## Objective

Add the foundational plumbing for file-based XML output: the `outputFile` field in `AppConfig`, three new IPC channel constants, new methods on the `ElectronAPI` type, config parsing for the `output-file` YAML key, preload bridge methods, and unit tests for the config changes.

## Skills Required

TypeScript for type definitions and config parsing logic. Electron knowledge for preload bridge `contextBridge`/`ipcRenderer` usage.

## Acceptance Criteria

- [ ] `AppConfig` in `src/shared/types.ts` has a new `outputFile: string` field
- [ ] `ElectronAPI` in `src/shared/types.ts` has three new methods: `onCloseRequested`, `saveAndQuit`, `discardAndQuit`
- [ ] `src/shared/ipc-channels.ts` exports three new channel constants: `APP_CLOSE_REQUESTED`, `APP_SAVE_AND_QUIT`, `APP_DISCARD_AND_QUIT`
- [ ] `src/main/config.ts` defaults `outputFile` to `'./review.xml'`
- [ ] `src/main/config.ts` `loadYamlConfig` parses the `output-file` key (non-empty string accepted)
- [ ] `src/preload/preload.ts` exposes `onCloseRequested`, `saveAndQuit`, `discardAndQuit` via `contextBridge`
- [ ] `src/main/config.test.ts` has tests for `outputFile` default, YAML parsing, and merge precedence
- [ ] All existing unit tests still pass (`npm run test:unit`)

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

- Node.js, TypeScript, Electron `contextBridge` + `ipcRenderer`
- Vitest for unit tests
- Existing config YAML parsing pattern (kebab-case keys mapped to camelCase)

## Input Dependencies

None. This is the foundational task.

## Output Artifacts

- Updated `src/shared/types.ts` (AppConfig + ElectronAPI)
- Updated `src/shared/ipc-channels.ts` (3 new constants)
- Updated `src/main/config.ts` (default + YAML parsing)
- Updated `src/preload/preload.ts` (3 new bridge methods)
- Updated `src/main/config.test.ts` (new test cases)

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### 1. `src/shared/types.ts`

**AppConfig** — add `outputFile: string` after the existing `outputFormat` field:

```typescript
export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  diffView: 'split' | 'unified';
  fontSize: number;
  outputFormat: string;
  outputFile: string;  // <-- NEW
  ignore: string[];
  categories: CategoryDef[];
  defaultDiffArgs: string;
  showUntracked: boolean;
  wordWrap: boolean;
}
```

**ElectronAPI** — add three new methods at the end of the interface:

```typescript
export interface ElectronAPI {
  // ... existing methods ...
  onCloseRequested: (callback: () => void) => void;
  saveAndQuit: () => void;
  discardAndQuit: () => void;
}
```

### 2. `src/shared/ipc-channels.ts`

Add three new constants to the `IPC` object, following the existing naming pattern:

```typescript
export const IPC = {
  // ... existing channels ...
  APP_CLOSE_REQUESTED: 'app:close-requested',
  APP_SAVE_AND_QUIT: 'app:save-and-quit',
  APP_DISCARD_AND_QUIT: 'app:discard-and-quit',
} as const;
```

### 3. `src/main/config.ts`

**Default** — add `outputFile: './review.xml'` to the `defaults` object:

```typescript
const defaults: AppConfig = {
  // ... existing defaults ...
  outputFile: './review.xml',
};
```

**YAML parsing** — add a block in `loadYamlConfig` to parse `output-file`:

```typescript
if ('output-file' in raw && typeof raw['output-file'] === 'string' && raw['output-file'].length > 0) {
  config.outputFile = raw['output-file'];
}
```

Place this near the existing `output-format` parsing block. Validation: accept any non-empty string. If empty or missing, the default applies.

### 4. `src/preload/preload.ts`

Add imports for the new IPC constants (they're already in the imported `IPC` object). Add three new methods to the `contextBridge.exposeInMainWorld` call:

```typescript
onCloseRequested: (callback: () => void) => {
  ipcRenderer.on(IPC.APP_CLOSE_REQUESTED, () => callback());
},

saveAndQuit: () => {
  ipcRenderer.send(IPC.APP_SAVE_AND_QUIT);
},

discardAndQuit: () => {
  ipcRenderer.send(IPC.APP_DISCARD_AND_QUIT);
},
```

### 5. `src/main/config.test.ts`

Add three test cases inside the existing `describe('loadConfig', ...)` block:

1. **Default outputFile value**: When no config files exist, `config.outputFile` should be `'./review.xml'`.
   - Modify the existing "returns default config when no config files exist" test to also assert `outputFile`.

2. **Parse output-file from YAML**: Create a test with YAML containing `output-file: './custom-output.xml'` and assert `config.outputFile === './custom-output.xml'`.

3. **Merge precedence for output-file**: Create a test where user config has `output-file: './user.xml'` and project config has `output-file: './project.xml'`. Assert project wins.

4. **Ignore empty output-file**: Create a test with `output-file: ''` and assert the default `'./review.xml'` is used.

Follow the exact mocking patterns used in the existing tests (same `vi.mocked(fs.existsSync)` and `vi.mocked(fs.readFileSync)` patterns).

### Running tests

```bash
npm run test:unit:main
```

</details>
