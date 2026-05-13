/**
 * Webapp step definitions for Feature 08: Rendered Markdown View.
 * Adapted from Electron steps — uses the webapp launcher with markdown fixture.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { launchWebapp, cleanup, getPage } from './app';
import type { ReviewState } from '../../packages/core/src/types';

const { Given, When, Then, After } = createBdd();

After(async () => {
  await cleanup();
});

// ── Given steps ──

Given('the webapp is loaded with markdown fixture data', async () => {
  await launchWebapp({ fixture: 'markdown' });
});

Given('the webapp is loaded with rendered HTML fixture data', async () => {
  await launchWebapp({ fixture: 'rendered-html' });
});

// ── When steps ──

When(
  'I click the {string} toggle for {string}',
  async ({}, toggleLabel: string, filePath: string) => {
    const page = getPage();
    const header = page.locator(`[data-testid="file-header-${filePath}"]`);
    await header.locator(`[aria-label="${toggleLabel} view"]`).click();
  }
);

When('I click on the gutter for a paragraph block', async () => {
  const page = getPage();
  const pBlock = page.locator('p.rendered-block').first();
  await pBlock.waitFor({ state: 'visible', timeout: 5000 });
  await pBlock.hover();
  const gutter = pBlock.locator('.rendered-gutter');
  await gutter.dispatchEvent('mousedown');
  await page.locator('[data-testid="comment-input"]').waitFor({ state: 'visible', timeout: 5000 });
});

When('I add a comment on the paragraph block', async () => {
  const page = getPage();
  const pBlock = page.locator('p.rendered-block').first();
  await pBlock.waitFor({ state: 'visible', timeout: 5000 });
  await pBlock.hover();
  const gutter = pBlock.locator('.rendered-gutter');
  await gutter.dispatchEvent('mousedown');
  await page.locator('[data-testid="comment-input"]').waitFor({ state: 'visible', timeout: 5000 });
  await page.locator('[data-testid="comment-input"] textarea').fill('Test rendered comment');
  await page.locator('[data-testid="add-comment-btn"]').click();
});

When(
  'I add rendered comment {string} on the block containing {string}',
  async ({}, commentBody: string, blockText: string) => {
    const page = getPage();
    const block = page.locator('.rendered-block').filter({ hasText: blockText }).first();
    await block.waitFor({ state: 'visible', timeout: 5000 });
    await block.hover();
    await block.locator('.rendered-gutter').dispatchEvent('mousedown');
    const input = page.locator('[data-testid="comment-input"]');
    await input.waitFor({ state: 'visible', timeout: 5000 });
    await input.locator('textarea').fill(commentBody);
    await page.locator('[data-testid="add-comment-btn"]').click();
    await expect(input).toHaveCount(0, { timeout: 5000 });
  }
);

When('I finish the webapp review', async () => {
  const page = getPage();
  await page.locator('[data-testid="finish-review-btn"]').click();
  await page.locator('#review-state').waitFor({ state: 'attached', timeout: 5000 });
});

// ── Then steps ──

Then(
  'I should see a {string} toggle in the file header for {string}',
  async ({}, toggleLabel: string, filePath: string) => {
    const page = getPage();
    const header = page.locator(`[data-testid="file-header-${filePath}"]`);
    await expect(header.locator(`[aria-label="${toggleLabel} view"]`)).toBeVisible({ timeout: 5000 });
  }
);

Then(
  'I should not see a {string} toggle in the file header for {string}',
  async ({}, toggleLabel: string, filePath: string) => {
    const page = getPage();
    const header = page.locator(`[data-testid="file-header-${filePath}"]`);
    await expect(header.locator(`[aria-label="${toggleLabel} view"]`)).toHaveCount(0);
  }
);

Then('I should see the markdown rendered as formatted HTML', async () => {
  const page = getPage();
  const view = page.locator('.rendered-markdown-view');
  await expect(view).toBeVisible({ timeout: 5000 });
  const hasContent = await view.locator('h1, h2, h3, p, ul, ol, pre').count();
  expect(hasContent).toBeGreaterThan(0);
});

Then('I should see the HTML rendered as formatted content', async () => {
  const page = getPage();
  const view = page.locator('.rendered-markdown-view[data-rendered-text-mode="html"]');
  await expect(view).toBeVisible({ timeout: 5000 });
  await expect(view.locator('h1')).toContainText('Release Notes');
  await expect(
    view.locator('p').filter({ hasText: 'Intro paragraph for rendered review.' }).first()
  ).toBeVisible();
  await expect(view.locator('ul').filter({ hasText: 'First listed item' }).first()).toBeVisible();
});

Then('I should see a gutter with line ranges', async () => {
  const page = getPage();
  const gutters = page.locator('.rendered-gutter');
  await expect(gutters.first()).toBeVisible({ timeout: 5000 });
  const text = await gutters.first().textContent();
  expect(text?.trim()).toMatch(/^\d+(-\d+)?$/);
});

Then(
  'the gutter should show collapsed line ranges like {string}',
  async ({}, expectedRange: string) => {
    const page = getPage();
    const gutters = page.locator('.rendered-gutter');
    await gutters.first().waitFor({ state: 'visible', timeout: 5000 });
    const count = await gutters.count();
    const rangeTexts: string[] = [];
    for (let i = 0; i < count; i++) {
      const text = (await gutters.nth(i).textContent())?.trim();
      if (text) rangeTexts.push(text);
    }
    expect(rangeTexts).toContain(expectedRange);
  }
);

Then('the comment input should open with the correct line range', async () => {
  const page = getPage();
  const commentInput = page.locator('[data-testid="comment-input"]');
  await expect(commentInput).toBeVisible({ timeout: 5000 });
  const text = await commentInput.textContent();
  expect(text).toMatch(/line/i);
});

Then('the comment should appear at the same source lines in the raw view', async () => {
  const page = getPage();
  const comments = page.locator(
    '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
  );
  await expect(comments.first()).toBeVisible({ timeout: 5000 });
  await expect(comments.first()).toContainText('Test rendered comment');
});

Then('the mermaid code block should render as an SVG diagram', async () => {
  const page = getPage();
  const svg = page.locator('.rendered-markdown-view svg');
  await expect(svg.first()).toBeVisible({ timeout: 10000 });
});

Then(
  'the saved review should include comments for {string}:',
  async ({}, filePath: string, table: DataTable) => {
    const page = getPage();
    const rawState = await page.locator('#review-state').textContent();
    expect(rawState).not.toBeNull();
    const state = JSON.parse(rawState ?? '{}') as ReviewState;
    const file = state.files.find(candidate => candidate.path === filePath);
    expect(file).toBeDefined();

    for (const row of table.hashes()) {
      const comment = file?.comments.find(candidate => candidate.body === row.body);
      expect(comment).toBeDefined();
      expect(comment?.lineRange).toEqual({
        side: row.side,
        start: Number(row.start),
        end: Number(row.end),
      });
    }
  }
);
