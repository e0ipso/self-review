---
id: 1
group: "core-implementation"
dependencies: []
status: "completed"
created: "2026-03-03"
skills:
  - typescript
  - nodejs
---
# Install `ignore` package and create ignore filter utility

## Objective
Install the `ignore` npm package and create a reusable filter utility module at `src/main/ignore-filter.ts`. Also update the default `ignore` array in `config.ts` with common vendor directory patterns.

## Skills Required
- typescript, nodejs

## Acceptance Criteria
- [ ] `ignore` package installed as a production dependency (with `@types/ignore` if needed)
- [ ] `src/main/ignore-filter.ts` exports `createIgnoreFilter(patterns: string[]): (path: string) => boolean`
- [ ] The returned function returns `true` for paths that should be KEPT (not ignored)
- [ ] Empty patterns array returns a function that keeps all paths
- [ ] Default `ignore` array in `config.ts` includes common vendor/build directory patterns
- [ ] Unit test in `src/main/ignore-filter.test.ts` verifies basic matching, negation, and empty patterns

## Technical Requirements
- Use the `ignore` npm package (https://www.npmjs.com/package/ignore)
- The filter function takes a relative file path (e.g., `node_modules/foo/bar.js`) and returns boolean

## Input Dependencies
None

## Output Artifacts
- `src/main/ignore-filter.ts` — reusable filter utility
- `src/main/ignore-filter.test.ts` — unit tests
- Updated `src/main/config.ts` defaults
- Updated `package.json` with `ignore` dependency

## Implementation Notes

<details>

### ignore-filter.ts

```typescript
import ignore from 'ignore';

export function createIgnoreFilter(patterns: string[]): (path: string) => boolean {
  if (patterns.length === 0) return () => true;
  const ig = ignore().add(patterns);
  return (filePath: string) => !ig.ignores(filePath);
}
```

### config.ts default ignore patterns

Update the `defaults` object's `ignore` array to:

```typescript
ignore: [
  '.git',
  'node_modules',
  'vendor',
  '.vendor',
  '__pycache__',
  '.venv',
  'venv',
  '.env',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'target',
  '*.min.js',
  '*.min.css',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'Gemfile.lock',
  'Cargo.lock',
  'poetry.lock',
  'go.sum',
],
```

### Unit tests

Test cases:
1. Filters out `node_modules/foo/bar.js` with default patterns
2. Keeps `src/main/index.ts` with default patterns
3. Empty patterns keeps everything
4. Negation pattern `!important.min.js` re-includes a file
5. `**` glob works (e.g., `dist/**` matches `dist/bundle.js`)

</details>
