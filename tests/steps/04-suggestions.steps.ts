/**
 * Step definitions for Feature 04: Code Suggestions.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { getPage, triggerCommentIcon } from './app';

const { Given, When, Then } = createBdd();

// ── Given: pre-existing comment with suggestion ──

Given(
  'I have added a comment with a suggestion on new line {int} of {string}',
  async ({}, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'new');
    const page = getPage();
    await page.locator('[data-testid="comment-input"] textarea').fill('Suggestion comment');
    await page.locator('[data-testid="add-suggestion-btn"]').click();
    await page.locator('[data-testid="suggestion-proposed"] textarea').fill('const fixed = true;');
    await page.locator('[data-testid="add-comment-btn"]').click();
  },
);

// ── When: suggestion interactions ──

When(
  'I type {string} in the proposed code editor',
  async ({}, code: string) => {
    const page = getPage();
    await page.locator('[data-testid="suggestion-proposed"] textarea').fill(code);
  },
);

When('I enter proposed code in the suggestion editor', async () => {
  const page = getPage();
  await page.locator('[data-testid="suggestion-proposed"] textarea').fill('try {\n  // wrapped\n} catch (e) {\n  throw e;\n}');
});

// ── Then: suggestion assertions ──

Then(
  'a suggestion editor should appear with original code pre-filled from new line {int}',
  async ({}, _line: number) => {
    const page = getPage();
    await expect(page.locator('[data-testid="suggestion-original"]')).toBeVisible();
    const value = await page.locator('[data-testid="suggestion-original"] textarea').inputValue();
    expect(value.length).toBeGreaterThan(0);
  },
);

Then(
  'a suggestion editor should appear with original code pre-filled from new lines {int}-{int}',
  async ({}, _start: number, _end: number) => {
    const page = getPage();
    await expect(page.locator('[data-testid="suggestion-original"]')).toBeVisible();
    const value = await page.locator('[data-testid="suggestion-original"] textarea').inputValue();
    expect(value.length).toBeGreaterThan(0);
  },
);

Then('the displayed comment should show a suggestion block', async () => {
  const page = getPage();
  await expect(page.locator('[data-testid="suggestion-block"]').first()).toBeVisible();
});

Then('the suggestion block should show original code as deleted lines', async () => {
  const page = getPage();
  const block = page.locator('[data-testid="suggestion-block"]').first();
  const deletionLines = block.locator('.suggestion-deletion');
  expect(await deletionLines.count()).toBeGreaterThan(0);
});

Then('the suggestion block should show proposed code as added lines', async () => {
  const page = getPage();
  const block = page.locator('[data-testid="suggestion-block"]').first();
  const additionLines = block.locator('.suggestion-addition');
  expect(await additionLines.count()).toBeGreaterThan(0);
});

Then('the suggestion block should have syntax-highlighted code', async () => {
  const page = getPage();
  const block = page.locator('[data-testid="suggestion-block"]').first();
  const tokens = block.locator('.token');
  expect(await tokens.count()).toBeGreaterThan(0);
});
