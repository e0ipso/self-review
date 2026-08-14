---
id: 1
group: "core-browser-conditional-exports"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["typescript", "nodejs"]
---
# Wire src/browser.ts into the Core Build and Package Manifest

## Objective
Add `src/browser.ts` as a second tsup entry point so that `dist/browser.js` is produced during the core build, then register a `browser` conditional export in `package.json` so bundlers (webpack `electron-renderer`, Vite browser mode) automatically resolve the Node.js-free bundle.

## Skills Required
- `typescript` — editing tsup configuration and package.json
- `nodejs` — understanding Node.js conditional exports spec and npm package manifest fields

## Acceptance Criteria
- [ ] `packages/core/tsup.config.ts` lists both `'src/index.ts'` and `'src/browser.ts'` in the `entry` array
- [ ] Running `npm run build` inside `packages/core` produces `dist/browser.js`, `dist/browser.cjs`, and `dist/browser.d.ts` without errors
- [ ] `packages/core/package.json` `exports["."]` contains `"browser": "./dist/browser.js"` placed **before** the `"import"` condition
- [ ] `grep -E "(child_process|\"fs\"|\"os\"|\"util\"|\"path\"|\"stream\")" packages/core/dist/browser.js` returns zero matches
- [ ] All existing unit tests in `packages/core` still pass (`npm run test:unit` inside the package)

## Technical Requirements
- tsup version `^8.0.0` (already installed); multi-entry support is built-in — just add to the array
- `dts: true` is already set, so declarations are generated automatically for each entry
- The `browser` condition must appear before `import`/`require` in the exports map — bundlers match the first applicable condition

## Input Dependencies
None — this task modifies only `packages/core` files.

## Output Artifacts
- Modified `packages/core/tsup.config.ts`
- Modified `packages/core/package.json`
- Built artifact `packages/core/dist/browser.js` (and `.cjs`, `.d.ts`) — required before Task 2 can be validated end-to-end

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

### 1. Update `packages/core/tsup.config.ts`

Change the `entry` array from:
```ts
entry: ['src/index.ts'],
```
to:
```ts
entry: ['src/index.ts', 'src/browser.ts'],
```

All other options (`format`, `dts`, `clean`, `sourcemap`, `external`) stay unchanged.

### 2. Update `packages/core/package.json` exports

The current `exports` block is:
```json
"exports": {
  ".": {
    "import": "./dist/index.js",
    "require": "./dist/index.cjs",
    "types": "./dist/index.d.ts"
  }
}
```

Change it to:
```json
"exports": {
  ".": {
    "browser": "./dist/browser.js",
    "import": "./dist/index.js",
    "require": "./dist/index.cjs",
    "types": "./dist/index.d.ts"
  }
}
```

`"browser"` must be the **first** key so bundlers that support the condition match it before `"import"`.

The `"files": ["dist"]` glob already covers the new artifacts — no change needed there.

### 3. Build and verify

```bash
cd packages/core
npm run build
# Expect output lines for dist/browser.js, dist/browser.cjs, dist/browser.d.ts

grep -E "(child_process|\"fs\"|\"os\"|\"util\"|\"path\"|\"stream\")" dist/browser.js
# Expect zero matches

npm run test:unit
# All tests must pass
```

</details>
