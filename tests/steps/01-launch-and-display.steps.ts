/**
 * Step definitions for Feature 01: App Launch and Diff Display.
 * Also contains shared Background steps used across all features.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { createTestRepo } from '../fixtures/test-repo';
import {
  launchApp,
  launchAppExpectExit,
  closeAppWindow,
  cleanup,
  getPage,
  getStdout,
  getStderr,
  getExitCode,
  setTestRepoDir,
  getTestRepoDir,
} from './app';

const { Given, When, Then, After } = createBdd();

// ── Cleanup after every scenario ──
After(async () => {
  await cleanup();
});

// ── Shared Background steps (used by many features) ──

Given(
  'a git repository with changes to the following files:',
  async ({}, table: DataTable) => {
    // The test-repo fixture creates a deterministic repo matching the Background tables
    const repoDir = createTestRepo();
    setTestRepoDir(repoDir);
  }
);

/**
 * Launch step with no args — uses bare `git diff` (unstaged changes).
 */
Given('I launch self-review', async () => {
  let repoDir: string;
  try {
    repoDir = getTestRepoDir();
  } catch {
    repoDir = process.cwd();
  }

  try {
    await launchApp([], repoDir);
  } catch (error) {
    console.error(
      '[Given step] launchApp() failed, falling back to launchAppExpectExit():',
      error
    );
    await launchAppExpectExit([], repoDir);
    console.error(
      '[Given step] After launchAppExpectExit - stderr:',
      getStderr().slice(0, 500)
    );
    console.error(
      '[Given step] After launchAppExpectExit - exit code:',
      getExitCode()
    );
  }
});

/**
 * Unified launch step - handles both normal (window expected) and
 * immediate-exit scenarios (--help, --version, git errors).
 */
Given('I launch self-review with {string}', async ({}, args: string) => {
  const cliArgs = args.split(/\s+/).filter(Boolean);

  // --help/--version don't need a repo; use a fallback cwd
  let repoDir: string;
  try {
    repoDir = getTestRepoDir();
  } catch {
    repoDir = process.cwd();
  }

  const expectsImmediateExit =
    cliArgs.includes('--help') ||
    cliArgs.includes('-h') ||
    cliArgs.includes('--version') ||
    cliArgs.includes('-v');

  if (expectsImmediateExit) {
    await launchAppExpectExit(cliArgs, repoDir);
  } else {
    try {
      await launchApp(cliArgs, repoDir);
    } catch (error) {
      // If Electron GUI can't start (error scenario or container env),
      // fall back to spawn to capture stdout/stderr/exitCode.
      console.error(
        '[Given step] launchApp() failed, falling back to launchAppExpectExit():',
        error
      );
      await launchAppExpectExit(cliArgs, repoDir);
      console.error(
        '[Given step] After launchAppExpectExit - stderr:',
        getStderr().slice(0, 500)
      );
      console.error(
        '[Given step] After launchAppExpectExit - exit code:',
        getExitCode()
      );
    }
  }
});

// ── Feature 01 steps ──

Then('the Electron window should be visible', async () => {
  const page = getPage();
  const visible = await page.evaluate(
    () => document.visibilityState === 'visible'
  );
  expect(visible).toBe(true);
});

Then('the file tree should list {int} file(s)', async ({}, count: number) => {
  const page = getPage();
  const entries = page.locator('[data-testid^="file-entry-"]');
  await expect(entries).toHaveCount(count);
});

Then(
  'the diff viewer should show {int} file sections',
  async ({}, count: number) => {
    const page = getPage();
    const sections = page.locator('[data-testid^="file-section-"]');
    await expect(sections).toHaveCount(count);
  }
);

Then(
  'the file tree entry for {string} should show change type {string}',
  async ({}, filePath: string, changeType: string) => {
    const page = getPage();
    const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
    const badgeMap: Record<string, string> = {
      modified: 'M',
      added: 'A',
      deleted: 'D',
      renamed: 'R',
    };
    const label = badgeMap[changeType];
    await expect(entry.locator('.change-type-badge')).toHaveText(label);
  }
);

Then(
  'the file tree entry for {string} should show {string}',
  async ({}, filePath: string, statsText: string) => {
    const page = getPage();
    const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
    const text = await entry.textContent();
    // Normalize whitespace for comparison
    const normalized = text?.replace(/\s+/g, '') || '';
    const expected = statsText.replace(/\s+/g, '');
    expect(normalized).toContain(expected);
  }
);

Then(
  'the diff viewer should show file sections in this order:',
  async ({}, table: DataTable) => {
    const page = getPage();
    const expectedOrder = table.hashes().map(row => row.file);
    const sections = page.locator('[data-testid^="file-section-"]');
    const count = await sections.count();
    const actualOrder: string[] = [];
    for (let i = 0; i < count; i++) {
      const testid = await sections.nth(i).getAttribute('data-testid');
      actualOrder.push(testid!.replace('file-section-', ''));
    }
    expect(actualOrder).toEqual(expectedOrder);
  }
);

Then(
  'the file section for {string} should contain highlighted code lines',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    // Prism.js adds token spans for highlighting
    const tokens = section.locator('.token');
    expect(await tokens.count()).toBeGreaterThan(0);
  }
);

Then('addition lines should have a green background', async () => {
  const page = getPage();
  const additionLine = page.locator('.diff-line-addition').first();
  await expect(additionLine).toBeVisible();
  await expect(additionLine).toHaveClass(/bg-green/);
});

Then('deletion lines should have a red background', async () => {
  const page = getPage();
  const deletionLine = page.locator('.diff-line-deletion').first();
  await expect(deletionLine).toBeVisible();
  await expect(deletionLine).toHaveClass(/bg-red/);
});

Then(
  'the file section for {string} should display hunk headers starting with {string}',
  async ({}, filePath: string, prefix: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const hunkHeaders = section.locator('.hunk-header');
    const count = await hunkHeaders.count();
    expect(count).toBeGreaterThan(0);
    for (let i = 0; i < count; i++) {
      const text = await hunkHeaders.nth(i).textContent();
      expect(text?.trim()).toMatch(
        new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
      );
    }
  }
);

When('I close the Electron window', async () => {
  await closeAppWindow();
});

Then('the process should exit with code {int}', async ({}, code: number) => {
  const exitCode = getExitCode();
  expect(exitCode).toBe(code);
});
