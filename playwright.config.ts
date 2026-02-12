import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const bddTestDir = defineBddConfig({
  features: 'tests/features/**/*.feature',
  steps: 'tests/steps/**/*.ts',
});

export default defineConfig({
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  projects: [
    {
      name: 'e2e',
      testDir: bddTestDir,
      timeout: process.env.CI ? 90_000 : 30_000,
      use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
    },
    {
      name: 'recording',
      testDir: 'tests/recording',
      timeout: 120_000,
    },
  ],
});
