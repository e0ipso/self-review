---
id: 1
group: "tree-shaking"
dependencies: []
status: "completed"
created: "2026-03-11"
skills: ["tsup", "typescript"]
---
# Enable treeshake, splitting, and sideEffects in @self-review/react

## Objective
Apply the two-part tree-shaking configuration to `packages/react`: add `treeshake: true` and `splitting: true` to the tsup build config, and add the `sideEffects` field to package.json so downstream bundlers can eliminate unused modules.

## Skills Required
- tsup / Rollup configuration
- TypeScript / JSON file editing

## Acceptance Criteria
- [ ] `packages/react/tsup.config.ts` has `treeshake: true` added to the `defineConfig` call
- [ ] `packages/react/tsup.config.ts` has `splitting: true` added to the `defineConfig` call
- [ ] `packages/react/package.json` has `"sideEffects": ["./dist/styles.css"]` added as a top-level field
- [ ] No other changes are made to either file

## Technical Requirements
- Edit `packages/react/tsup.config.ts`: add `treeshake: true` and `splitting: true` inside the existing `defineConfig({...})` object. All existing keys (`entry`, `format`, `dts`, `clean`, `sourcemap`, `external`) remain unchanged.
- Edit `packages/react/package.json`: add `"sideEffects": ["./dist/styles.css"]` as a top-level JSON field (alongside `"name"`, `"version"`, etc.).

## Input Dependencies
None — this is the first task.

## Output Artifacts
- Modified `packages/react/tsup.config.ts`
- Modified `packages/react/package.json`

## Implementation Notes

<details>
<summary>Step-by-step instructions</summary>

### 1. Edit `packages/react/tsup.config.ts`

Current content:
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
  ],
});
```

Target content — add `treeshake: true` and `splitting: true`:
```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
  ],
});
```

### 2. Edit `packages/react/package.json`

Add `"sideEffects": ["./dist/styles.css"]` as a top-level field. A natural place is after the `"files"` field:

```json
"files": [
  "dist"
],
"sideEffects": ["./dist/styles.css"],
```

Do not change any other field in package.json.

</details>
