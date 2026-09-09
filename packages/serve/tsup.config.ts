import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/cli.ts'],
  format: ['esm'],
  clean: true,
  sourcemap: true,
  external: ['@self-review/core', '@self-review/react'],
});
