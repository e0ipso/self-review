import path from 'path';

export default {
  test: {
    environment: 'jsdom',
    include: [
      'packages/react/src/**/*.test.{ts,tsx}',
      'src/renderer/**/*.test.{ts,tsx}',
    ],
    exclude: [
      'node_modules/**',
      '.webpack/**',
      'out/**',
      '.features-gen/**',
      'tests/**',
    ],
    globals: true, // Enable browser globals
    mockReset: true,
    restoreMocks: true,
    timeout: 5000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      include: [
        'src/renderer/**/*.{ts,tsx}',
        'src/shared/**/*.ts',
        'packages/react/src/**/*.{ts,tsx}',
      ],
      exclude: [
        'node_modules/',
        '.webpack/',
        'out/',
        '.features-gen/',
        'tests/',
        '**/*.test.{ts,tsx}',
        '**/*.d.ts',
        // Listed individually, not by wildcard, so a component picks up
        // coverage the moment it gains a test file (SR-0039).
        'src/renderer/components/AboutDialog.tsx',
        'src/renderer/components/CloseConfirmDialog.tsx',
        'src/renderer/components/FindBar.tsx',
        'src/renderer/components/UpdateBanner.tsx',
      ],
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@self-review/core': path.resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
};
