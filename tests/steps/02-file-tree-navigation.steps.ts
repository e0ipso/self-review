/**
 * Step definitions for Feature 02: File Tree Navigation.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { getPage } from './app';

const { When, Then } = createBdd();

When('I click {string} in the file tree', async ({}, filePath: string) => {
  const page = getPage();
  await page.locator(`[data-testid="file-entry-${filePath}"]`).click();
});

Then(
  'the diff viewer should scroll to the {string} file section',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await expect(section).toBeVisible();
    // Verify the section is in the viewport
    const box = await section.boundingBox();
    expect(box).not.toBeNull();
    const viewport = page.viewportSize();
    if (viewport && box) {
      expect(box.y).toBeLessThan(viewport.height);
    }
  }
);

Then(
  'the {string} entry in the file tree should be highlighted',
  async ({}, filePath: string) => {
    const page = getPage();
    const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
    await expect(entry).toHaveClass(/bg-accent/);
  }
);

When(
  'I scroll the diff viewer to the {string} file section',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await section.scrollIntoViewIfNeeded();
    // Wait for IntersectionObserver to update the active file in the tree
    await page.locator(`[data-testid="file-entry-${filePath}"]`).waitFor({ state: 'visible' });
    // Give the observer callback time to propagate through React state
    await page.waitForFunction(
      (fp) => {
        const entry = document.querySelector(`[data-testid="file-entry-${fp}"]`);
        return entry?.className.includes('bg-accent') ?? false;
      },
      filePath,
      { timeout: 5000 }
    ).catch(() => {
      // If the entry doesn't get bg-accent (e.g. already active), proceed
    });
  }
);

When(
  'I type {string} in the file tree search input',
  async ({}, query: string) => {
    const page = getPage();
    await page.locator('[data-testid="file-search"]').fill(query);
  }
);

When('I clear the file tree search input', async () => {
  const page = getPage();
  await page.locator('[data-testid="file-search"]').fill('');
});

Then('the file tree should show {string}', async ({}, filePath: string) => {
  const page = getPage();
  const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
  await expect(entry).toBeVisible();
});

Then('the file tree should not show {string}', async ({}, filePath: string) => {
  const page = getPage();
  const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
  await expect(entry).toHaveCount(0);
});
