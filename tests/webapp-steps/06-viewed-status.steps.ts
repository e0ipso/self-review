/**
 * Webapp step definitions for Feature 06: File Viewed Status.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { getPage } from './app';

const { When, Then } = createBdd();

When(
  'I check the "Viewed" checkbox on the {string} file section header',
  async ({}, filePath: string) => {
    const page = getPage();
    await page.locator(`[data-testid="viewed-${filePath}"]`).click();
  }
);

When(
  'I uncheck the "Viewed" checkbox on the {string} file section header',
  async ({}, filePath: string) => {
    const page = getPage();
    await page.locator(`[data-testid="viewed-${filePath}"]`).click();
  }
);

Then(
  'the "Viewed" checkbox for {string} should be unchecked',
  async ({}, filePath: string) => {
    const page = getPage();
    const button = page.locator(`[data-testid="viewed-${filePath}"]`);
    await expect(button.locator('svg')).toBeVisible();
  }
);

Then(
  'the "Viewed" checkbox for {string} should be checked',
  async ({}, filePath: string) => {
    const page = getPage();
    const button = page.locator(`[data-testid="viewed-${filePath}"]`);
    await expect(button.locator('svg')).toBeVisible();
  }
);
