---
id: 2
group: types-package
dependencies:
  - 1
status: completed
created: '2026-03-11'
skills:
  - typescript
---
# Update `@self-review/core` to Re-export from `@self-review/types`

## Objective
Convert `packages/core/src/types.ts` from a definitions file into a re-export barrel pointing at `@self-review/types`, and update core's `package.json` and `tsup.config.ts` accordingly.

## Skills Required
TypeScript package authoring, tsup configuration.

## Acceptance Criteria
- [ ] `packages/core/src/types.ts` is now a pure re-export barrel: `export type * from '@self-review/types'`
- [ ] `packages/core/package.json` lists `"@self-review/types": "*"` under `dependencies`
- [ ] `@self-review/types` is added to the `external` array in `packages/core/tsup.config.ts`
- [ ] `npm run build` in `packages/core/` exits 0
- [ ] All existing core unit tests still pass (`npm run test:unit` in `packages/core/`)

## Technical Requirements
- The re-export barrel must preserve all named exports so downstream code importing from `@self-review/core` continues to work unchanged
- `external` in `tsup.config.ts` prevents tsup from bundling `@self-review/types` into core's output

## Input Dependencies
- Task 01: `packages/types/` package must exist with `src/index.ts` defining all types

## Output Artifacts
- Modified `packages/core/src/types.ts` (now a re-export barrel)
- Modified `packages/core/package.json` (new dep)
- Modified `packages/core/tsup.config.ts` (new external)

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

### 1. Replace `packages/core/src/types.ts` contents

Replace the entire file with:
```ts
// All shared types now live in @self-review/types.
// This barrel re-exports them for backward compatibility.
export type * from '@self-review/types';
```

### 2. Update `packages/core/package.json`

Add to `dependencies`:
```json
"@self-review/types": "*"
```

### 3. Update `packages/core/tsup.config.ts`

Current content:
```ts
external: ['xmllint-wasm', 'fast-xml-parser', 'yaml', 'ignore'],
```

Add `@self-review/types`:
```ts
external: ['xmllint-wasm', 'fast-xml-parser', 'yaml', 'ignore', '@self-review/types'],
```

### 4. Verify

```bash
cd packages/core
npm run build    # must exit 0
npm run test:unit # all tests must pass
```

Note: `export type *` is TypeScript 5.0+ syntax and is valid here since the project uses TypeScript ~5.9.

</details>
