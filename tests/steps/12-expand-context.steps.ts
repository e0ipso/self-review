/**
 * Step definitions for Feature 12: Expand Context.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { getPage } from './app';

const { When, Then } = createBdd();

// ── State tracking for before/after comparison ──

let lineCountBefore = 0;

// ── Then: expand bar visibility ──

Then(
  'expand context bars should be visible in the {string} file section',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const bars = section.locator('.expand-context-bar');
    await expect(bars.first()).toBeVisible({ timeout: 5000 });
  }
);

Then(
  'expand context bars should not be visible in the {string} file section',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const bars = section.locator('.expand-context-bar');
    await expect(bars).toHaveCount(0, { timeout: 10000 });
  }
);

// ── Then: count diff lines for before/after comparison ──

Then(
  'I should see diff lines in the {string} file section',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const lines = section.locator('[data-line-number]');
    lineCountBefore = await lines.count();
    expect(lineCountBefore).toBeGreaterThan(0);
  }
);

// ── When: expand interactions ──

When(
  'I click the first expand-down button in the {string} file section',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const downButton = section.locator('.expand-context-bar button').filter({
      has: page.locator('svg.lucide-chevron-down'),
    });
    await downButton.first().click();
    await page.waitForTimeout(1000);
  }
);

When(
  'I click "show all" on an expand bar in the {string} file section',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    // Click the text-based "Show all hidden lines" button in the label area
    const showAllButton = section
      .locator('.expand-context-bar button')
      .filter({ hasText: /show all/i });
    // If "show all" buttons exist, click them all (top, between, bottom)
    const count = await showAllButton.count();
    for (let i = 0; i < count; i++) {
      await showAllButton.nth(0).click();
      await page.waitForTimeout(1000);
    }
    // Also handle small-gap "Show N hidden lines" buttons
    const showNButton = section
      .locator('.expand-context-bar button')
      .filter({ hasText: /show \d+ hidden/i });
    const nCount = await showNButton.count();
    for (let i = 0; i < nCount; i++) {
      // Always click the first remaining one since they disappear after click
      await showNButton.nth(0).click();
      await page.waitForTimeout(1000);
    }
  }
);

// ── Then: more context lines after expansion ──

Then(
  'the {string} file section should have more context lines than before',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const lines = section.locator('[data-line-number]');
    const lineCountAfter = await lines.count();
    expect(lineCountAfter).toBeGreaterThan(lineCountBefore);
  }
);
