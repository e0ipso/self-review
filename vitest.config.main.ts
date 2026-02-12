import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts'],
    exclude: ['node_modules/**', '.webpack/**', 'out/**', '.features-gen/**', 'tests/**'],
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
