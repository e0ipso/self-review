---
id: 1
group: "infrastructure"
dependencies: []
status: "pending"
created: "2026-02-12"
skills:
  - vitest
  - typescript
---
# Setup Vitest Infrastructure and Configuration

## Objective

Install Vitest dependencies and create separate configuration files for main and renderer processes, along with npm scripts for running tests and collecting coverage.

## Skills Required

- **vitest**: Configure Vitest with separate environments for Electron's main (Node.js) and renderer (jsdom) processes
- **typescript**: Set up TypeScript path aliases and module resolution for test files

## Acceptance Criteria

- [ ] Vitest dependencies installed (`vitest`, `@vitest/ui`, `@vitest/coverage-v8`, `jsdom` or `happy-dom`)
- [ ] `vitest.config.main.ts` created for main process tests (Node.js environment)
- [ ] `vitest.config.renderer.ts` created for renderer process tests (jsdom environment)
- [ ] npm scripts added to package.json: `test:unit`, `test:unit:main`, `test:unit:renderer`, `test:unit:run`, `test:coverage`
- [ ] Both configs have proper TypeScript path alias resolution
- [ ] Coverage is configured to exclude node_modules, .webpack, out, .features-gen, tests (e2e)
- [ ] Coverage reporters set to: text, html, json-summary
- [ ] Tests can run in both dev container and host machine

Use your internal Todo tool to track these and keep on track.

## Technical Requirements

### Dependencies to Install

```bash
npm install -D vitest @vitest/ui @vitest/coverage-v8 jsdom
```

### Main Process Config (`vitest.config.main.ts`)

- **Environment**: `node` (native Node.js, no DOM)
- **Test pattern**: `src/main/**/*.test.ts`
- **Timeout**: 5000ms default
- **TypeScript**: Match path aliases from `tsconfig.json`
- **Coverage include**: `src/main/**/*.ts`

### Renderer Process Config (`vitest.config.renderer.ts`)

- **Environment**: `jsdom` (simulated browser)
- **Test pattern**: `src/renderer/**/*.test.{ts,tsx}`
- **Globals**: Enable browser globals (window, document, etc.)
- **TypeScript**: Match path aliases, support JSX
- **Coverage include**: `src/renderer/**/*.{ts,tsx}`, `src/shared/**/*.ts`

### Shared Coverage Config

- **Provider**: v8
- **Output**: `coverage/` directory
- **Reporters**: `['text', 'html', 'json-summary']`
- **Exclude**:
  - `node_modules/`
  - `.webpack/`
  - `out/`
  - `.features-gen/`
  - `tests/` (e2e tests)
  - `**/*.test.{ts,tsx}`
  - `**/*.d.ts`
  - `src/renderer/components/**/*` (UI components, not tested initially)

### Package Scripts

Add to `package.json`:
```json
{
  "test:unit": "vitest",
  "test:unit:main": "vitest --config vitest.config.main.ts",
  "test:unit:renderer": "vitest --config vitest.config.renderer.ts",
  "test:unit:run": "vitest run",
  "test:coverage": "vitest run --coverage"
}
```

## Input Dependencies

- Existing `tsconfig.json` for path alias configuration
- Existing `package.json` for script additions

## Output Artifacts

- `vitest.config.main.ts` - Main process test configuration
- `vitest.config.renderer.ts` - Renderer process test configuration
- Updated `package.json` with test scripts
- `node_modules/` with Vitest dependencies

## Implementation Notes

<details>
<summary>Configuration Details</summary>

### Main Process Config Example

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts'],
    globals: false,
    mockReset: true,
    restoreMocks: true,
    timeout: 5000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'json-summary'],
    include: ['src/main/**/*.ts'],
    exclude: [
      'node_modules/',
      '.webpack/',
      'out/',
      '.features-gen/',
      'tests/',
      '**/*.test.ts',
      '**/*.d.ts',
    ],
  },
});
```

### Renderer Process Config Example

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/renderer/**/*.test.{ts,tsx}'],
    globals: true, // Enable browser globals
    mockReset: true,
    restoreMocks: true,
    timeout: 5000,
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  coverage: {
    provider: 'v8',
    reporter: ['text', 'html', 'json-summary'],
    include: ['src/renderer/**/*.{ts,tsx}', 'src/shared/**/*.ts'],
    exclude: [
      'node_modules/',
      '.webpack/',
      'out/',
      '.features-gen/',
      'tests/',
      '**/*.test.{ts,tsx}',
      '**/*.d.ts',
      'src/renderer/components/**/*', // UI components not tested initially
    ],
  },
});
```

### Verification

After setup, verify:
1. Run `npm run test:unit:run` - should exit with "no tests found" (success)
2. Run `npm run test:coverage` - should generate coverage report (empty)
3. Check that configs don't conflict with webpack or e2e test configs
4. Test in dev container if available

### Dev Container Considerations

- Unit tests don't require display server (unlike e2e tests)
- Ensure Node.js version in container matches Electron's Node version
- No additional X11 or xvfb needed for unit tests

</details>
