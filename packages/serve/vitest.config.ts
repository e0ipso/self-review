import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

function sibling(relative: string): string {
  return fileURLToPath(new URL(relative, import.meta.url));
}

export default defineConfig({
  resolve: {
    // Test against the package sources, not their build output. The root
    // `test:unit` script (pre-commit hook and CI) runs with no package build
    // step, so a runtime import of `@self-review/core` or `@self-review/react`
    // must not depend on `packages/*/dist` existing or being current.
    //
    // Ordered: a string `find` also matches as a prefix, so the stylesheet
    // entry has to come before the package it is a subpath of.
    alias: [
      {
        find: '@self-review/react/styles.css',
        replacement: sibling('../react/src/build-styles.css'),
      },
      { find: '@self-review/react', replacement: sibling('../react/src/index.ts') },
      { find: '@self-review/core', replacement: sibling('../core/src/index.ts') },
    ],
  },
  test: {
    // The server suites run in Node; the browser client's suite opts into
    // jsdom with a `@vitest-environment` docblock.
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
});
