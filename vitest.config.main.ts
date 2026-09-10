import path from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/main/**/*.test.ts'],
    exclude: ['node_modules/**', '.webpack/**', 'out/**', '.features-gen/**', 'tests/**'],
    globals: false,
    mockReset: true,
    restoreMocks: true,
    testTimeout: 5000,
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
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
