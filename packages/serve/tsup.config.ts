import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts', 'src/resume-parser-worker.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  noExternal: ['@self-review/core/validation', '@self-review/core/resume-worker'],
  external: ['@self-review/core', '@self-review/react'],
});
