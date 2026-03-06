/**
 * Webapp step definitions for Feature 07: Empty Diff Help Message.
 * Adapted from Electron steps — uses the webapp launcher instead.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { launchWebapp, cleanup, getPage } from './app';

const { Given, When, Then, After } = createBdd();

After(async () => {
  await cleanup();
});

// ── Given steps ──

Given('the webapp is loaded with an empty diff', async () => {
  await launchWebapp({ fixture: 'empty' });
});

Given('the webapp is loaded with an empty diff and arguments {string}', async ({}, args: string) => {
  await launchWebapp({ fixture: 'empty', gitDiffArgs: args });
});

// ── Then: empty diff help assertions ──

Then('the diff viewer should display an empty diff help message', async () => {
  const page = getPage();
  const helpMessage = page.locator('[data-testid="empty-diff-help"]');
  await expect(helpMessage).toBeVisible();
});

Then('the help message should explain that arguments are passed to git diff', async () => {
  const page = getPage();
  const helpMessage = page.locator('[data-testid="empty-diff-help"]');
  await expect(helpMessage).toContainText('git diff');
});

Then('the help message should include the following examples:', async ({}, table: DataTable) => {
  const page = getPage();
  const helpMessage = page.locator('[data-testid="empty-diff-help"]');
  const rows = table.hashes();
  for (const row of rows) {
    await expect(helpMessage).toContainText(row.command);
  }
});

Then('the help message should show that the arguments {string} were passed to git diff', async ({}, args: string) => {
  const page = getPage();
  const helpMessage = page.locator('[data-testid="empty-diff-help"]');
  await expect(helpMessage).toContainText(args);
});

Then('the help message should suggest trying different arguments', async () => {
  const page = getPage();
  const helpMessage = page.locator('[data-testid="empty-diff-help"]');
  await expect(helpMessage).toContainText('different');
});

Then('the diff viewer should not display an empty diff help message', async () => {
  const page = getPage();
  const helpMessage = page.locator('[data-testid="empty-diff-help"]');
  await expect(helpMessage).toHaveCount(0);
});

Then('the file tree should display the message {string}', async ({}, text: string) => {
  const page = getPage();
  const fileTree = page.locator('[data-testid="file-tree"]');
  await expect(fileTree).toContainText(text);
});

Then('the file tree file count badge should show {int}', async ({}, count: number) => {
  const page = getPage();
  const badge = page.locator('[data-testid="file-tree"] .h-5.px-1\\.5');
  await expect(badge).toContainText(`${count}`);
});
