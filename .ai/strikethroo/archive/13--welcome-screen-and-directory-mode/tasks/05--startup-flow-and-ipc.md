---
id: 5
group: "main-process"
dependencies: [1, 2, 3]
status: "completed"
created: "2026-02-16"
skills:
  - electron
  - typescript
---

# Update Startup Flow and Add IPC Channels

## Objective

Replace the hard git gate in `main.ts` with a conditional branch that routes to git mode, directory mode, or welcome mode. Add the `dialog:pick-directory` IPC channel for the welcome screen's directory picker. Update CLI parsing to handle macOS Finder's `-psn_XXXX` argument.

## Skills Required

- Electron main process, TypeScript

## Acceptance Criteria

- [ ] App no longer hard-exits when launched outside a git repo
- [ ] When CWD is a git repo: current behavior preserved (git mode)
- [ ] When CWD is not a git repo + one positional arg resolves to an existing directory: directory mode
- [ ] When CWD is not a git repo + no valid directory arg: welcome mode (window opens with empty diff, `source.type: 'welcome'`)
- [ ] `-psn_XXXX` arguments from macOS Finder are filtered out in CLI parsing
- [ ] New IPC channel `dialog:pick-directory` opens native directory picker and returns selected path or null
- [ ] `dialog:pick-directory` defaults to home directory
- [ ] After user picks a directory via welcome screen, main process determines mode and sends `diff:load`
- [ ] IPC channel constant added to `src/shared/ipc-channels.ts`
- [ ] Preload bridge updated with new IPC method in `ElectronAPI` interface
- [ ] TypeScript compiles with zero errors

## Technical Requirements

- Use `electron.dialog.showOpenDialog({ properties: ['openDirectory'], defaultPath: app.getPath('home') })`
- The IPC handler for `dialog:pick-directory` should be `handle`/`invoke` pattern (returns a value)
- After directory selection, main process checks if it's a git repo (try running `git rev-parse --git-dir` in that directory)
- Route to git mode or directory mode accordingly, then send `diff:load` with computed `DiffFile[]` + `DiffSource`

## Input Dependencies

- Task 1: `DiffSource` type for constructing the source payload
- Task 2: `synthetic-diff.ts` for generating diffs from file paths
- Task 3: `directory-scanner.ts` for scanning non-git directories

## Output Artifacts

- Updated `src/main/main.ts` with conditional startup flow
- Updated `src/main/cli.ts` with `-psn_XXXX` filtering
- Updated `src/shared/ipc-channels.ts` with new channel constant
- Updated `src/main/ipc-handlers.ts` with `dialog:pick-directory` handler
- Updated `src/preload/preload.ts` with new method on `ElectronAPI`
- Updated `src/shared/types.ts` `ElectronAPI` interface (if defined there)

## Implementation Notes

<details>

1. **Update `src/main/cli.ts`**: Filter out `-psn_XXXX` arguments before parsing:
   ```typescript
   const filteredArgs = process.argv.filter(arg => !arg.startsWith('-psn_'));
   ```

2. **Update `src/main/main.ts`** startup flow:
   - Remove or conditionalize the `validateGitAvailable()` call
   - After CLI parsing, determine mode:
     ```typescript
     async function determineMode(cliArgs: ParsedArgs): Promise<DiffSource> {
       // Check if CWD is a git repo
       const isGitRepo = await checkIsGitRepo(process.cwd());
       if (isGitRepo) {
         return { type: 'git', gitDiffArgs: cliArgs.rawArgs, repository: await getRepoRoot() };
       }

       // Check if there's a positional arg that's an existing directory
       const positionalPath = cliArgs.positionalArgs?.[0];
       if (positionalPath) {
         const resolvedPath = path.resolve(positionalPath);
         const stat = await fs.stat(resolvedPath).catch(() => null);
         if (stat?.isDirectory()) {
           return { type: 'directory', sourcePath: resolvedPath };
         }
       }

       return { type: 'welcome' };
     }
     ```
   - For git mode: run existing git diff flow
   - For directory mode: call `scanDirectory()` from `directory-scanner.ts`
   - For welcome mode: create window, send empty diff with `source: { type: 'welcome' }`

3. **Add IPC channel** to `src/shared/ipc-channels.ts`:
   ```typescript
   export const DIALOG_PICK_DIRECTORY = 'dialog:pick-directory';
   ```

4. **Add IPC handler** in `src/main/ipc-handlers.ts`:
   ```typescript
   ipcMain.handle(DIALOG_PICK_DIRECTORY, async () => {
     const result = await dialog.showOpenDialog({
       properties: ['openDirectory'],
       defaultPath: app.getPath('home'),
     });
     if (result.canceled || result.filePaths.length === 0) return null;
     return result.filePaths[0];
   });
   ```

5. **Update preload bridge** in `src/preload/preload.ts`:
   - Add `pickDirectory: () => ipcRenderer.invoke(DIALOG_PICK_DIRECTORY)` to the exposed API

6. **Update `ElectronAPI` interface** (in `types.ts` or wherever it's defined):
   - Add `pickDirectory(): Promise<string | null>`

7. **Wire welcome → review transition**: After the user picks a directory from the welcome screen, the renderer calls `electronAPI.pickDirectory()`, gets the path, then main process needs to:
   - Check if it's a git repo
   - Scan the directory or run git diff
   - Send `diff:load` with the result

   This may need a second IPC channel like `review:start-from-directory` that takes the path, does the scanning, and sends `diff:load`. Alternatively, the `dialog:pick-directory` handler can do all of this and send `diff:load` as a side effect. Choose the simpler approach.

8. **Test**: Launch the app without a git repo context and verify it doesn't crash.

</details>
