/**
 * Webapp step definitions for Feature 02: File Tree Navigation.
 * Same logic as Electron steps — only imports differ.
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
    // Wait for scroll animation to complete
    await page.waitForTimeout(500);
    const viewport = page.viewportSize();
    if (viewport) {
      await expect(async () => {
        const box = await section.boundingBox();
        expect(box).not.toBeNull();
        expect(box!.y).toBeLessThan(viewport.height);
      }).toPass({ timeout: 5000 });
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
    await page.locator(`[data-testid="file-entry-${filePath}"]`).waitFor({ state: 'visible' });
    await page.waitForFunction(
      (fp: string) => {
        const entry = document.querySelector(`[data-testid="file-entry-${fp}"]`);
        return entry?.className.includes('bg-accent') ?? false;
      },
      filePath,
      { timeout: 5000 }
    ).catch(() => {});
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
  await expect(page.locator(`[data-testid="file-entry-${filePath}"]`)).toBeVisible();
});

Then('the file tree should not show {string}', async ({}, filePath: string) => {
  const page = getPage();
  await expect(page.locator(`[data-testid="file-entry-${filePath}"]`)).toHaveCount(0);
});
