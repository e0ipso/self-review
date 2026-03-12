import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  treeshake: true,
  splitting: true,
  external: [
    'react',
    'react-dom',
    'react/jsx-runtime',
    '@self-review/types',
  ],
});
