---
id: 2
group: "core-browser-conditional-exports"
dependencies: [1]
status: "completed"
created: "2026-03-11"
skills: ["webpack", "vite"]
---
# Remove Within-Repo Browser Entry Aliases

## Objective
Remove the two `resolve.alias` workarounds that pointed `@self-review/core` directly at `packages/core/src/browser.ts` source. After Task 1, both webpack (`electron-renderer` target) and Vite (browser mode) resolve `@self-review/core` via the `browser` conditional export automatically — the aliases are redundant and should be deleted to prove the conditional export works end-to-end.

## Skills Required
- `webpack` — editing `webpack.renderer.config.ts` and understanding `electron-renderer` target condition resolution
- `vite` — editing `tests/webapp/vite.config.ts` and understanding Vite's default `browser` condition handling

## Acceptance Criteria
- [ ] `webpack.renderer.config.ts` no longer contains any `'@self-review/core'` alias; the `resolve.alias` object is either removed entirely or contains only other entries
- [ ] `tests/webapp/vite.config.ts` no longer contains any `'@self-review/core'` alias; the `resolve.alias` object is either removed entirely or the `resolve` key is removed if it becomes empty
- [ ] `npm run test:e2e` (webapp e2e Vite dev server) passes — confirming Vite resolves `dist/browser.js` via the conditional export
- [ ] `path` import (used for the removed alias) is cleaned up if it becomes unused in `webpack.renderer.config.ts`

## Technical Requirements
- **Prerequisite**: `packages/core` must be built (`npm run build` inside `packages/core`) before running tests, as both consumers now depend on `dist/browser.js` existing
- webpack `electron-renderer` target includes `browser` in its default `conditionNames` in webpack 5 — no additional webpack config needed
- Vite resolves the `browser` condition by default in browser mode — no additional Vite config needed

## Input Dependencies
- Task 1: `packages/core/package.json` must have the `browser` conditional export, and `dist/browser.js` must exist

## Output Artifacts
- Modified `webpack.renderer.config.ts`
- Modified `tests/webapp/vite.config.ts`

## Implementation Notes

<details>
<summary>Step-by-step implementation</summary>

### 1. Update `webpack.renderer.config.ts`

Current state (lines 37–42):
```ts
resolve: {
  extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  alias: {
    '@self-review/core': path.resolve(__dirname, 'packages/core/src/browser.ts'),
  },
},
```

Target state — remove the `alias` key entirely (it has no other entries):
```ts
resolve: {
  extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
},
```

Also check whether the `import path from 'path'` at the top of the file is still used elsewhere. If the only use of `path` was the alias, remove the import too.

### 2. Update `tests/webapp/vite.config.ts`

Current state (lines 12–16):
```ts
resolve: {
  alias: {
    '@self-review/core': path.resolve(__dirname, '../../packages/core/src/browser.ts'),
  },
},
```

The `resolve` block has no other entries. Remove it entirely:
```ts
export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5199,
    strictPort: true,
  },
});
```

Check whether `import path from 'path'` is still needed (it is used for `root: path.resolve(__dirname)`) — keep it.

### 3. Ensure core is built, then run webapp e2e

```bash
# Must have run: cd packages/core && npm run build
npm run test:e2e
# All webapp e2e scenarios must pass
```

</details>
