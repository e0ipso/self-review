import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['./vitest.setup.ts'],
    // The bundle tests build with tsup, which resolves its tsconfig and writes
    // its source comments relative to process.cwd(), so they chdir into the
    // package. Worker threads cannot chdir; forked processes can.
    pool: 'forks',
  },
});
