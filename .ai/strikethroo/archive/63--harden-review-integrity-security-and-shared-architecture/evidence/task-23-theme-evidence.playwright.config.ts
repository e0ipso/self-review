// Playwright config for task-23-theme-evidence.spec.ts only. See that file.
import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: __dirname,
  testMatch: 'task-23-theme-evidence.spec.ts',
  retries: 0,
  workers: 1,
  timeout: 120_000,
  reporter: 'list',
  use: { trace: 'off', screenshot: 'off' },
});
