/**
 * Webapp step definitions for Feature 04: Code Suggestions.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { getPage, triggerCommentIcon } from './app';

const { When, Then } = createBdd();

When(
  'I type {string} in the proposed code editor',
  async ({}, code: string) => {
    const page = getPage();
    await page
      .locator('[data-testid="suggestion-proposed"] textarea')
      .fill(code);
  }
);

Then(
  'a suggestion editor should appear with original code pre-filled from new line {int}',
  async ({}, _line: number) => {
    const page = getPage();
    await expect(
      page.locator('[data-testid="suggestion-original"]')
    ).toBeVisible();
    const original = await page
      .locator('[data-testid="suggestion-original"] textarea')
      .inputValue();
    expect(original.length).toBeGreaterThan(0);
    const proposed = await page
      .locator('[data-testid="suggestion-proposed"] textarea')
      .inputValue();
    expect(proposed).toBe(original);
  }
);

Then(
  'the proposed code editor should contain {string}',
  async ({}, expected: string) => {
    const page = getPage();
    const value = await page
      .locator('[data-testid="suggestion-proposed"] textarea')
      .inputValue();
    expect(value).toBe(expected);
  }
);

Then('the displayed comment should show a suggestion block', async () => {
  const page = getPage();
  await expect(
    page.locator('[data-testid="suggestion-block"]').first()
  ).toBeVisible();
});
