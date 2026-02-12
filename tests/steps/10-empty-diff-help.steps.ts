/**
 * Step definitions for Feature 10: Empty Diff Help Message.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { mkdtempSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { getPage, getStdout, getExitCode, setTestRepoDir } from './app';

const { Given, When, Then } = createBdd();

// ── Given: repo with no changes matching specific args ──

Given(
  'a git repository with no changes matching {string}',
  async ({}, _args: string) => {
    // Create a clean repo with no staged/unstaged changes
    const dir = mkdtempSync(join(tmpdir(), 'self-review-clean-'));
    execSync('git init', { cwd: dir, stdio: 'pipe' });
    execSync('git config user.email "test@test.com"', {
      cwd: dir,
      stdio: 'pipe',
    });
    execSync('git config user.name "Test"', { cwd: dir, stdio: 'pipe' });
    writeFileSync(join(dir, 'README.md'), '# Test');
    execSync('git add -A && git commit -m "init"', { cwd: dir, stdio: 'pipe' });
    setTestRepoDir(dir);
  }
);

// ── Then: empty diff help assertions ──

Then('the diff viewer should display an empty diff help message', async () => {
  const page = getPage();
  const helpMessage = page.locator('[data-testid="empty-diff-help"]');
  await expect(helpMessage).toBeVisible();
});

Then(
  'the help message should explain that arguments are passed to git diff',
  async () => {
    const page = getPage();
    const helpMessage = page.locator('[data-testid="empty-diff-help"]');
    await expect(helpMessage).toContainText('git diff');
  }
);

Then(
  'the help message should include the following examples:',
  async ({}, table: DataTable) => {
    const page = getPage();
    const helpMessage = page.locator('[data-testid="empty-diff-help"]');
    const rows = table.hashes();
    for (const row of rows) {
      await expect(helpMessage).toContainText(row.command);
    }
  }
);

Then(
  'the help message should show that the arguments {string} were passed to git diff',
  async ({}, args: string) => {
    const page = getPage();
    const helpMessage = page.locator('[data-testid="empty-diff-help"]');
    await expect(helpMessage).toContainText(args);
  }
);

Then('the help message should suggest trying different arguments', async () => {
  const page = getPage();
  const helpMessage = page.locator('[data-testid="empty-diff-help"]');
  await expect(helpMessage).toContainText('different');
});

Then(
  'the diff viewer should not display an empty diff help message',
  async () => {
    const page = getPage();
    const helpMessage = page.locator('[data-testid="empty-diff-help"]');
    await expect(helpMessage).toHaveCount(0);
  }
);

Then(
  'the diff viewer should show {int} file section(s)',
  async ({}, count: number) => {
    const page = getPage();
    const sections = page.locator('[data-testid^="file-section-"]');
    await expect(sections).toHaveCount(count);
  }
);

Then(
  'the file tree should display the message {string}',
  async ({}, text: string) => {
    const page = getPage();
    const fileTree = page.locator('[data-testid="file-tree"]');
    await expect(fileTree).toContainText(text);
  }
);

Then(
  'the file tree file count badge should show {int}',
  async ({}, count: number) => {
    const page = getPage();
    const badge = page.locator('[data-testid="file-tree"] .h-5.px-1\\.5');
    await expect(badge).toContainText(`${count}`);
  }
);
