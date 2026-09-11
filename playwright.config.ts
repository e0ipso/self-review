import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const bddTestDir = defineBddConfig({
  features: 'tests/features/**/*.feature',
  steps: 'tests/steps/**/*.ts',
  outputDir: '.features-gen/electron',
});

const webappBddTestDir = defineBddConfig({
  features: 'tests/webapp-features/**/*.feature',
  steps: 'tests/webapp-steps/**/*.ts',
  outputDir: '.features-gen/webapp',
});

export default defineConfig({
  retries: process.env.CI ? 2 : 1,
  workers: 1,
  projects: [
    {
      name: 'electron',
      testDir: bddTestDir,
      timeout: process.env.CI ? 90_000 : 30_000,
      use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
    },
    {
      name: 'e2e',
      testDir: webappBddTestDir,
      timeout: 60_000,
      use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
      },
    },
    {
      // Serve mode: the built executable run as an ordinary child process,
      // driven through a browser, asserted on the document it writes. Its own
      // project because it needs neither the Electron package nor the webapp
      // fixture server — only `packages/serve/dist`.
      name: 'serve',
      testDir: 'tests/serve',
      timeout: 120_000,
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
    {
      name: 'screenshots',
      testDir: 'tests/screenshots',
      timeout: 120_000,
    },
  ],
});
