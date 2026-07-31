---
id: 1
group: 'fix-production-xml-output'
dependencies: []
status: 'completed'
created: '2026-02-12'
skills:
  - webpack
  - electron-packaging
---

# Fix WASM File Location in Webpack

## Objective

Ensure `xmllint-wasm` can find its WASM binary in both dev and production builds by co-locating `xmllint.wasm` with the main bundle output, where the library expects it (`__dirname + "/xmllint.wasm"`).

## Skills Required

- **webpack**: Modify CopyWebpackPlugin configuration
- **electron-packaging**: Understand ASAR structure and asarUnpack implications

## Acceptance Criteria

- [ ] `xmllint.wasm` is copied to the root of the webpack main output directory (not `native_modules/`)
- [ ] Production build (`npm run make`) produces XML on stdout when window is closed
- [ ] Dev mode (`npm start`) continues to work with XML output
- [ ] `asarUnpack` in forge.config.ts is updated: remove `native_modules` if nothing else uses it, or keep only if other native modules exist

## Technical Requirements

- **File**: `webpack.main.config.ts` — Change CopyWebpackPlugin `to` from `'native_modules/xmllint.wasm'` to `'xmllint.wasm'`
- **File**: `forge.config.ts` — Review `asarUnpack: ['**/native_modules/**']`; if no other files use native_modules, remove or update this pattern
- `xmllint-wasm` resolves WASM via `__dirname + "/xmllint.wasm"` — it expects the file alongside its own JS module in the same directory

## Input Dependencies

None.

## Output Artifacts

- Updated webpack and forge config
- Production build that can load WASM and emit XML

## Implementation Notes

<details>
<summary>Step-by-step instructions</summary>

1. **Edit `webpack.main.config.ts`**: In the CopyWebpackPlugin patterns, change:
   ```ts
   to: 'native_modules/xmllint.wasm',
   ```
   to:
   ```ts
   to: 'xmllint.wasm',
   ```
   This places the WASM file in the same directory as the bundled main JS (webpack output root).

2. **Edit `forge.config.ts`**: Check if `asarUnpack: ['**/native_modules/**']` is still needed. After the change, nothing will be in `native_modules/`. Options:
   - Remove the asarUnpack entirely if nothing else uses it
   - Or keep a minimal pattern if other native modules exist elsewhere

3. **Verify**: Run `npm run make`, then execute the packaged binary, open a diff, close the window — XML should appear on stdout.
</details>
