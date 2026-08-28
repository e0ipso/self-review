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
      // The full served loop against the packaged binary. Plain specs rather
      // than BDD: this is one scenario about a command's artifact, not a
      // feature surface a non-developer reads.
      name: 'serve',
      testDir: 'tests/serve',
      // Boots a packaged Electron binary, which relaunches itself headless
      // before it listens, then drives a browser through a whole review.
      timeout: process.env.CI ? 120_000 : 90_000,
      use: {
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        viewport: { width: 1280, height: 800 },
        launchOptions: {
          // Same container-safe flags the webapp suite launches with.
          args: [
            '--no-sandbox',
            '--disable-dev-shm-usage',
            '--disable-setuid-sandbox',
            '--disable-gpu',
          ],
          ...(process.env.PW_CHROMIUM_PATH
            ? { executablePath: process.env.PW_CHROMIUM_PATH }
            : {}),
        },
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
