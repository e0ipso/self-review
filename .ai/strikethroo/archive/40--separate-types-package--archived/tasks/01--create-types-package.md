---
id: 1
group: types-package
dependencies: []
status: completed
created: '2026-03-11'
skills:
  - typescript
---
# Create `@self-review/types` Package

## Objective
Scaffold a new zero-dependency `packages/types/` workspace package containing all shared TypeScript interfaces and type aliases currently living in `packages/core/src/types.ts`.

## Skills Required
TypeScript package authoring, tsup build configuration, npm workspaces.

## Acceptance Criteria
- [ ] `packages/types/package.json` exists with name `@self-review/types`, matching the pattern of `@self-review/core` (ESM + CJS, dual exports)
- [ ] `packages/types/tsconfig.json` exists, mirrors `packages/core/tsconfig.json`
- [ ] `packages/types/tsup.config.ts` exists, produces both ESM and CJS with `dts: true`
- [ ] `packages/types/src/index.ts` exists containing every type definition verbatim copied from `packages/core/src/types.ts` **plus** `ImageLoadResult` (currently defined only in `src/shared/types.ts`)
- [ ] Package has zero runtime dependencies (no `dependencies` key or empty)
- [ ] `npm run build` inside `packages/types/` exits 0 and produces `dist/`
- [ ] `ImageLoadResult` is now exported from `packages/types/src/index.ts`

## Technical Requirements
- Match the dual-format exports pattern of `packages/core`:
  ```json
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  }
  ```
- `tsup.config.ts` must use `format: ['esm', 'cjs']` and `dts: true`
- No external deps to declare in tsup (pure types, no imports)
- The `src/index.ts` must be pure type definitions — no `import` statements referencing other packages

## Input Dependencies
None — this is the foundational task.

## Output Artifacts
- `packages/types/` directory with fully working package
- `packages/types/src/index.ts` — canonical source for all shared types

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

### 1. Gather existing types

Copy the entire contents of `packages/core/src/types.ts` (178 lines). These are all pure `export type` / `export interface` / `export const` (for const enums if any) declarations — no imports from other packages.

Also copy `ImageLoadResult` from `src/shared/types.ts` (line 32):
```ts
export type ImageLoadResult = { dataUri: string } | { error: string };
```

### 2. Create `packages/types/package.json`

```json
{
  "name": "@self-review/types",
  "version": "1.0.0",
  "description": "Shared TypeScript types for self-review packages",
  "repository": {
    "type": "git",
    "url": "https://github.com/e0ipso/self-review.git",
    "directory": "packages/types"
  },
  "publishConfig": {
    "access": "public"
  },
  "type": "module",
  "main": "dist/index.cjs",
  "module": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "require": "./dist/index.cjs",
      "types": "./dist/index.d.ts"
    }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsup"
  },
  "devDependencies": {
    "tsup": "^8.0.0",
    "typescript": "~5.9.0"
  },
  "license": "MIT"
}
```

### 3. Create `packages/types/tsconfig.json`

Mirror `packages/core/tsconfig.json` exactly:
```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "esnext",
    "moduleResolution": "bundler",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
```

### 4. Create `packages/types/tsup.config.ts`

```ts
import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
});
```

### 5. Create `packages/types/src/index.ts`

Copy verbatim all type definitions from `packages/core/src/types.ts`. Then append `ImageLoadResult`:

```ts
// Image loading result (also used by Electron app)
export type ImageLoadResult = { dataUri: string } | { error: string };
```

Make sure all exports are at the top level with `export type` or `export interface`.

### 6. Run build

```bash
cd packages/types && npm run build
```

Confirm `dist/index.js`, `dist/index.cjs`, and `dist/index.d.ts` are produced.

</details>
