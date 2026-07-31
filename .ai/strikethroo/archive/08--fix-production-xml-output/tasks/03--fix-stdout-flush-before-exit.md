---
id: 3
group: 'fix-production-xml-output'
dependencies: []
status: 'completed'
created: '2026-02-12'
skills:
  - typescript
  - nodejs
---

# Fix Stdout Flush Before Exit

## Objective

Guarantee XML data reaches the pipe reader before the process terminates by using the callback form of `process.stdout.write()` and only calling `process.exit(0)` after the write callback completes.

## Skills Required

- **typescript**: Modify close handler in main process
- **nodejs**: Understand process I/O and stdout flushing behavior

## Acceptance Criteria

- [ ] `process.stdout.write()` is called with a callback; `mainWindow.destroy()` and `process.exit(0)` are invoked only inside the callback
- [ ] Pattern: `process.stdout.write(xml + '\n', () => { mainWindow.destroy(); process.exit(0); });`
- [ ] No data loss when stdout is piped (e.g. `self-review --staged | tee output.xml`)

## Technical Requirements

- **File**: `src/main/main.ts` — Window close handler (around lines 264–276)
- Replace `process.stdout.write(xml); process.stdout.write('\n'); ... process.exit(0);` with `process.stdout.write(xml + '\n', () => { mainWindow.destroy(); mainWindow = null; process.exit(0); });`
- Ensure `mainWindow` reference is available in the callback (closure)

## Input Dependencies

None.

## Output Artifacts

- Updated close handler that exits only after stdout flush

## Implementation Notes

<details>
<summary>Step-by-step instructions</summary>

1. **Locate the close handler** in `src/main/main.ts` (~lines 264–276). Current code:
   ```ts
   process.stdout.write(xml);
   process.stdout.write('\n');
   // ...
   mainWindow.destroy();
   mainWindow = null;
   process.exit(0);
   ```

2. **Replace with single write + callback**:
   ```ts
   process.stdout.write(xml + '\n', () => {
     mainWindow.destroy();
     mainWindow = null;
     process.exit(0);
   });
   ```
   Remove the separate `process.stdout.write('\n')` and the immediate `mainWindow.destroy()` / `process.exit(0)` — they move into the callback.

3. **Ensure `mainWindow` is in scope**: The close handler already captures `mainWindow`; the callback is a closure so it will see the same variable.

4. **Error handling**: The existing try/catch remains. If `serializeReview` throws, we never reach the write. The callback-based write does not change error handling.
</details>
