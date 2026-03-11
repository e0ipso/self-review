/**
 * Webapp step definitions for Feature 01: Launch and Diff Display.
 * Adapted from Electron steps — uses the webapp launcher instead.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { launchWebapp, cleanup, getPage } from './app';

const { Given, When, Then, After } = createBdd();

After(async () => {
  await cleanup();
});

// ── Background steps ──

Given('the webapp is loaded with fixture data', async () => {
  await launchWebapp();
});

Given('the webapp is loaded with commenting categories', async () => {
  await launchWebapp({ categories: 'commenting' });
});

// ── Then: display assertions (same selectors as Electron tests) ──

Then('the file tree should list {int} file(s)', async ({}, count: number) => {
  const page = getPage();
  const entries = page.locator('[data-testid^="file-entry-"]');
  await expect(entries).toHaveCount(count);
});

Then('the diff viewer should show {int} file sections', async ({}, count: number) => {
  const page = getPage();
  const sections = page.locator('[data-testid^="file-section-"]');
  await expect(sections).toHaveCount(count);
});

Then(
  'the file tree entry for {string} should show change type {string}',
  async ({}, filePath: string, changeType: string) => {
    const page = getPage();
    const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
    const badge = entry.locator('.change-type-badge');
    const expected: Record<string, string> = {
      modified: 'M',
      added: 'A',
      deleted: 'D',
      renamed: 'R',
    };
    await expect(badge).toHaveText(expected[changeType] ?? changeType);
  }
);

Then(
  'the file tree entry for {string} should show {string}',
  async ({}, filePath: string, expectedText: string) => {
    const page = getPage();
    const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
    const text = await entry.textContent();
    const normalized = text?.replace(/\s+/g, ' ').trim();
    expect(normalized).toContain(expectedText);
  }
);

Then(
  'the diff viewer should show file sections in this order:',
  async ({}, table: DataTable) => {
    const page = getPage();
    const expectedFiles = table.hashes().map(row => row.file);
    const sections = page.locator('[data-testid^="file-section-"]');
    const count = await sections.count();
    const actualFiles: string[] = [];
    for (let i = 0; i < count; i++) {
      const testId = await sections.nth(i).getAttribute('data-testid');
      if (testId) {
        actualFiles.push(testId.replace('file-section-', ''));
      }
    }
    expect(actualFiles).toEqual(expectedFiles);
  }
);

Then(
  'the file section for {string} should contain highlighted code lines',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const tokens = section.locator('.token');
    // Prism.js is lazy-loaded asynchronously; wait for the first token to appear
    // before counting, so the assertion is not racy.
    await expect(tokens.first()).toBeAttached({ timeout: 10000 });
    expect(await tokens.count()).toBeGreaterThan(0);
  }
);

Then('addition lines should have a green background', async () => {
  const page = getPage();
  const additionLines = page.locator('[class*="bg-emerald"]');
  expect(await additionLines.count()).toBeGreaterThan(0);
});

Then('deletion lines should have a red background', async () => {
  const page = getPage();
  const deletionLines = page.locator('[class*="bg-red"]');
  expect(await deletionLines.count()).toBeGreaterThan(0);
});

Then(
  'the file section for {string} should display hunk headers starting with {string}',
  async ({}, filePath: string, prefix: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const hunkHeaders = section.locator('.hunk-header');
    expect(await hunkHeaders.count()).toBeGreaterThan(0);
    const text = await hunkHeaders.first().textContent();
    expect(text?.trim()).toMatch(new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`));
  }
);
