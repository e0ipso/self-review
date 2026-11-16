/**
 * Webapp step definitions for Feature 14: Color contrast.
 *
 * The jsdom axe tests disable `color-contrast` because jsdom computes no
 * layout or colors, so this rule runs here, in a real browser.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { launchWebapp, getPage, triggerCommentIcon } from './app';

const { Given, When, Then } = createBdd();

Given('the webapp is loaded for a contrast check with {string}', async ({}, query: string) => {
  await launchWebapp(Object.fromEntries(new URLSearchParams(query)));
});

When(
  'I add a {string} comment on new line {int} of {string}',
  async ({}, category: string, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'new');
    const page = getPage();
    await page.locator('[data-testid="comment-input"] textarea').fill('Categorized comment');
    await page.locator(`[data-testid="category-option-${category}"]`).click();
    await page.locator('[data-testid="add-comment-btn"]').click();
    await expect(page.locator('[data-testid="comment-input"]')).toHaveCount(0);
  }
);

When(
  'I open a comment draft on new line {int} of {string}',
  async ({}, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'new');
  }
);

Then('all text should meet WCAG AA contrast', async () => {
  const page = getPage();
  // Rendered previews and diagrams settle asynchronously.
  await page.waitForLoadState('networkidle');
  const height = await page.evaluate(() =>
    Math.max(
      document.documentElement.scrollHeight,
      ...[...document.querySelectorAll('*')].map(element => element.scrollHeight)
    )
  );
  await page.setViewportSize({ width: 1280, height: Math.min(height, 16_000) });
  await page.addScriptTag({ path: require.resolve('axe-core') });
  const violations = await page.evaluate(async () => {
    const axe = (window as unknown as { axe: typeof import('axe-core') }).axe;
    const result = await axe.run(document, { runOnly: ['color-contrast'] });
    return result.violations.flatMap(violation =>
      violation.nodes.map(node => `${node.target.join(' ')}: ${node.any[0]?.message ?? ''}`)
    );
  });
  expect(violations).toEqual([]);
});
