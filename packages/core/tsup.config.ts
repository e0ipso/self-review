import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/operations.ts', 'src/filesystem.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['xmllint-wasm', 'fast-xml-parser', 'yaml', 'ignore', '@self-review/types'],
});
