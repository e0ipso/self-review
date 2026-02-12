import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'tests/features/**/*.feature',
  steps: 'tests/steps/**/*.ts',
});

export default defineConfig({
  testDir,
  timeout: process.env.CI ? 60_000 : 30_000,
  retries: 0,
  use: {
    trace: 'on-first-retry',
  },
});
