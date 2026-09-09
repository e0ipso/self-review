import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      // Test against the core sources, not its build output. The root
      // `test:unit` script (pre-commit hook and CI) runs with no package build
      // step, so a runtime import of `@self-review/core` must not depend on
      // `packages/core/dist` existing or being current.
      '@self-review/core': fileURLToPath(new URL('../core/src/index.ts', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
