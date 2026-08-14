---
id: 1
group: "type-system"
dependencies: []
status: "completed"
created: "2026-02-16"
skills:
  - typescript
---

# Introduce DiffSource Discriminated Union Type

## Objective

Replace hard-coded `gitDiffArgs: string` and `repository: string` fields in `src/shared/types.ts` with a `DiffSource` discriminated union that supports git, directory, and welcome-screen states. Update all downstream consumers to use the new type.

## Skills Required

- TypeScript discriminated unions and type-safe refactoring

## Acceptance Criteria

- [ ] `DiffSource` type is defined in `src/shared/types.ts` with three variants: `git`, `directory`, `welcome`
- [ ] `ReviewState` uses `source: DiffSource` instead of `gitDiffArgs` + `repository`
- [ ] `DiffLoadPayload` (or equivalent IPC payload type) uses `source: DiffSource`
- [ ] All files importing the old fields are updated to use `source.type` discriminant
- [ ] TypeScript compiles with zero errors
- [ ] Existing unit tests pass without modification (or with minimal type-only fixes)

## Technical Requirements

- The `DiffSource` union must be:
  ```typescript
  export type DiffSource =
    | { type: 'git'; gitDiffArgs: string; repository: string }
    | { type: 'directory'; sourcePath: string }
    | { type: 'welcome' };
  ```
- Every consumer that currently reads `gitDiffArgs` or `repository` must switch to pattern matching on `source.type`

## Input Dependencies

None — this is the foundation task.

## Output Artifacts

- Updated `src/shared/types.ts` with `DiffSource` type
- All downstream files updated to compile with the new type shape

## Implementation Notes

<details>

1. **Define the type** in `src/shared/types.ts`:
   ```typescript
   export type DiffSource =
     | { type: 'git'; gitDiffArgs: string; repository: string }
     | { type: 'directory'; sourcePath: string }
     | { type: 'welcome' };
   ```

2. **Update `ReviewState`**: Replace `gitDiffArgs: string` and `repository: string` with `source: DiffSource`. Look for the interface definition and change it.

3. **Update `DiffLoadPayload`** (or whatever type is used to send diff data from main to renderer via IPC): Replace the git-specific fields with `source: DiffSource`.

4. **Fix all compile errors**: Run `npx tsc --noEmit` and fix every error. Files likely affected:
   - `src/main/ipc-handlers.ts` — where `ReviewState` or `DiffLoadPayload` is constructed
   - `src/main/main.ts` — where git data is assembled and passed around
   - `src/main/xml-serializer.ts` — reads `gitDiffArgs` and `repository` from `ReviewState`
   - `src/main/xml-parser.ts` — constructs `ReviewState` from parsed XML
   - `src/renderer/context/ReviewContext.tsx` — stores and provides these values
   - `src/renderer/components/Toolbar.tsx` — displays `gitDiffArgs`
   - `src/preload/preload.ts` — if it types the payload

5. **For now, default to `type: 'git'` everywhere** — the other modes will be wired in by later tasks. The goal is to get the type shape right and everything compiling. Where git data is currently constructed, wrap it:
   ```typescript
   source: { type: 'git', gitDiffArgs: args, repository: repo }
   ```

6. **Run existing unit tests** (`npm run test:unit`) to verify nothing breaks.

</details>
