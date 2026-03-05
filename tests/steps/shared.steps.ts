/**
 * Shared step definitions used across multiple Electron e2e features.
 * Extracted from the deleted feature 01-06 step files which contained
 * Background steps and common actions.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { createTestRepo } from '../fixtures/test-repo';
import {
  launchApp,
  launchAppExpectExit,
  cleanup,
  getPage,
  getStderr,
  getExitCode,
  setTestRepoDir,
  getTestRepoDir,
  saveAndCloseApp,
} from './app';

const { Given, When, Then, After } = createBdd();

// ── Cleanup after every scenario ──
After(async () => {
  await cleanup();
});

// ── Shared Background steps ──

Given(
  'a git repository with changes to the following files:',
  async ({}, table: DataTable) => {
    const repoDir = createTestRepo();
    setTestRepoDir(repoDir);
  }
);

Given(
  'the project has these comment categories:',
  async ({}, table: DataTable) => {
    const categories = table.hashes();
    const yamlLines = ['categories:'];
    for (const cat of categories) {
      yamlLines.push(`  - name: "${cat.name}"`);
      yamlLines.push(`    description: "${cat.name} category"`);
      yamlLines.push(`    color: "${cat.color}"`);
    }
    const repoDir = getTestRepoDir();
    writeFileSync(
      join(repoDir, '.self-review.yaml'),
      yamlLines.join('\n') + '\n'
    );
  }
);

// ── Shared launch steps ──

Given('I launch self-review', async () => {
  let repoDir: string;
  try {
    repoDir = getTestRepoDir();
  } catch {
    repoDir = process.cwd();
  }

  try {
    await launchApp([], repoDir);
  } catch {
    await launchAppExpectExit([], repoDir);
  }
});

Given('I launch self-review with {string}', async ({}, args: string) => {
  const cliArgs = args.split(/\s+/).filter(Boolean);

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

// ── Shared UI actions ──

When('I click {string}', async ({}, buttonText: string) => {
  const page = getPage();
  if (buttonText === 'Add comment' || buttonText === 'Comment') {
    await page.locator('[data-testid="add-comment-btn"]').click();
  } else if (buttonText === 'Cancel') {
    await page.locator('[data-testid="cancel-comment-btn"]').click();
  } else if (buttonText === 'Add suggestion') {
    await page.locator('[data-testid="add-suggestion-btn"]').click();
  } else if (buttonText === 'Finish Review') {
    await saveAndCloseApp();
  }
});

When('I replace the text with {string}', async ({}, newText: string) => {
  const page = getPage();
  const textarea = page.locator('[data-testid="comment-input"] textarea');
  await textarea.fill(newText);
});

// ── Shared assertions ──

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

Then('the file tree should list {int} file(s)', async ({}, count: number) => {
  const page = getPage();
  const entries = page.locator('[data-testid^="file-entry-"]');
  await expect(entries).toHaveCount(count);
});

Then('the comment should show {string}', async ({}, expectedText: string) => {
  const page = getPage();
  const comments = page.locator(
    '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
  );
  const lastComment = comments.last();
  await expect(lastComment).toContainText(expectedText);
});

Then('the process should exit with code {int}', async ({}, code: number) => {
  const exitCode = getExitCode();
  expect(exitCode).toBe(code);
});
