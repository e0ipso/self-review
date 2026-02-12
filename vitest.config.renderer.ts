import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'jsdom',
    include: ['src/renderer/**/*.test.{ts,tsx}'],
    exclude: ['node_modules/**', '.webpack/**', 'out/**', '.features-gen/**', 'tests/**'],
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
