/**
 * Step definitions for Feature 05: View Modes and Toolbar.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { getPage } from './app';

const { When, Then } = createBdd();

// ── When: toolbar interactions ──

When(
  'I click the {string} view mode toggle in the toolbar',
  async ({}, mode: string) => {
    const page = getPage();
    if (mode === 'Unified') {
      await page.locator('[data-testid="view-mode-unified"]').click();
    } else if (mode === 'Split') {
      await page.locator('[data-testid="view-mode-split"]').click();
    }
  },
);

When('I click {string} in the toolbar', async ({}, buttonText: string) => {
  const page = getPage();
  if (buttonText === 'Collapse all') {
    await page.locator('[data-testid="collapse-all-btn"]').click();
  } else if (buttonText === 'Expand all') {
    await page.locator('[data-testid="expand-all-btn"]').click();
  }
});

When(
  'I click the collapse toggle on the {string} file section header',
  async ({}, filePath: string) => {
    const page = getPage();
    const header = page.locator(`[data-testid="file-header-${filePath}"]`);
    await header.locator('[data-testid="collapse-toggle"]').click();
  },
);

When('I switch the theme to {string} in the toolbar', async ({}, theme: string) => {
  const page = getPage();
  await page.locator(`[data-testid="theme-option-${theme.toLowerCase()}"]`).click();
});

// ── Then: view mode assertions ──

Then(
  'the diff viewer should be in {string} view mode',
  async ({}, mode: string) => {
    const page = getPage();
    if (mode === 'split') {
      await expect(page.locator('[data-testid="diff-viewer"] .split-view').first()).toBeVisible();
    } else if (mode === 'unified') {
      await expect(page.locator('[data-testid="diff-viewer"] .unified-view').first()).toBeVisible();
    }
  },
);

Then('the split view should show two columns', async () => {
  const page = getPage();
  const splitView = page.locator('.split-view').first();
  // Split view has two halves (w-1/2 each)
  const halves = splitView.locator('.split-half');
  expect(await halves.count()).toBeGreaterThanOrEqual(2);
});

Then(
  'the unified view should show a single column with +\\\/- prefixes',
  async () => {
    const page = getPage();
    const unifiedView = page.locator('.unified-view').first();
    const prefixes = unifiedView.locator('.line-prefix');
    expect(await prefixes.count()).toBeGreaterThan(0);
  },
);

// ── Then: collapse/expand assertions ──

Then('all file sections should be collapsed', async () => {
  const page = getPage();
  const sections = page.locator('[data-testid^="file-section-"]');
  const count = await sections.count();
  for (let i = 0; i < count; i++) {
    const content = sections.nth(i).locator('.file-diff-content');
    await expect(content).toHaveCount(0);
  }
});

Then('the diff content should not be visible for any file', async () => {
  const page = getPage();
  const diffContent = page.locator('.file-diff-content');
  await expect(diffContent).toHaveCount(0);
});

Then('all file sections should be expanded', async () => {
  const page = getPage();
  const sections = page.locator('[data-testid^="file-section-"]');
  const count = await sections.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    const content = sections.nth(i).locator('.file-diff-content');
    await expect(content).toHaveCount(1);
  }
});

Then('the {string} file section should be collapsed', async ({}, filePath: string) => {
  const page = getPage();
  const section = page.locator(`[data-testid="file-section-${filePath}"]`);
  const content = section.locator('.file-diff-content');
  await expect(content).toHaveCount(0);
});

Then(
  'the {string} file section should still be expanded',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const content = section.locator('.file-diff-content');
    await expect(content).toHaveCount(1);
  },
);

// ── Then: diff stats assertions ──

Then('the toolbar should show {string}', async ({}, text: string) => {
  const page = getPage();
  const stats = page.locator('[data-testid="diff-stats"]');
  await expect(stats).toContainText(text);
});

Then('the toolbar should show additions count {string}', async ({}, text: string) => {
  const page = getPage();
  const stats = page.locator('[data-testid="diff-stats"]');
  await expect(stats).toContainText(text);
});

Then('the toolbar should show deletions count {string}', async ({}, text: string) => {
  const page = getPage();
  const stats = page.locator('[data-testid="diff-stats"]');
  await expect(stats).toContainText(text);
});

// ── Then: theme assertions ──

Then('the application should use dark theme colors', async () => {
  const page = getPage();
  const hasDarkClass = await page.evaluate(() =>
    document.documentElement.classList.contains('dark'),
  );
  expect(hasDarkClass).toBe(true);
});

Then('the application should use light theme colors', async () => {
  const page = getPage();
  const hasDarkClass = await page.evaluate(() =>
    document.documentElement.classList.contains('dark'),
  );
  expect(hasDarkClass).toBe(false);
});
