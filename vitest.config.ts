import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    // By default, exclude e2e tests and generated files
    include: ['src/**/*.test.{ts,tsx}'],
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
    include: ['src/**/*.{ts,tsx}'],
    exclude: [
      'node_modules/',
      '.webpack/',
      'out/',
      '.features-gen/',
      'tests/',
      '**/*.test.{ts,tsx}',
      '**/*.d.ts',
      'src/renderer/components/**/*',
    ],
  },
});
