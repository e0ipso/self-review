/**
 * Step definitions for Feature 13: Rendered Markdown View.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { execSync } from 'child_process';
import { join } from 'path';
import { tmpdir } from 'os';
import { getPage, setTestRepoDir } from './app';

const { Given, When, Then } = createBdd();

// ── Helpers ──

/**
 * Creates a temporary git repo with a single new (untracked) file.
 * The file will appear as "added" when the app detects untracked files.
 */
function createRepoWithNewFile(fileName: string, content: string): string {
  const repoDir = mkdtempSync(join(tmpdir(), 'self-review-md-'));
  const run = (cmd: string) =>
    execSync(cmd, { cwd: repoDir, stdio: 'pipe' }).toString();

  run('git init');
  run('git config user.email "test@test.com"');
  run('git config user.name "Test"');

  // Create an initial commit so the repo is valid
  writeFileSync(join(repoDir, '.gitkeep'), '');
  run('git add -A');
  run('git commit -m "Initial commit"');

  // Create subdirectories if the file name includes a path
  const dir = join(repoDir, fileName, '..');
  mkdirSync(dir, { recursive: true });

  // Write the new untracked file — it will appear as "added"
  writeFileSync(join(repoDir, fileName), content);

  return repoDir;
}

// ── Given steps ──

Given(
  'a git repository with a new markdown file {string} containing:',
  async ({}, fileName: string, docString: string) => {
    const repoDir = createRepoWithNewFile(fileName, docString);
    setTestRepoDir(repoDir);
  }
);

Given(
  'a git repository with a new file {string} containing:',
  async ({}, fileName: string, docString: string) => {
    const repoDir = createRepoWithNewFile(fileName, docString);
    setTestRepoDir(repoDir);
  }
);

// ── When steps ──

When(
  'I click the {string} toggle for {string}',
  async ({}, toggleLabel: string, filePath: string) => {
    const page = getPage();
    const header = page.locator(
      `[data-testid="file-header-${filePath}"]`
    );
    await header
      .locator(`[aria-label="${toggleLabel} view"]`)
      .click();
  }
);

When('I click on the gutter for a paragraph block', async () => {
  const page = getPage();
  // Find the first <p> that is a rendered-block (has gutter)
  const pBlock = page.locator('p.rendered-block').first();
  await pBlock.waitFor({ state: 'visible', timeout: 5000 });

  // Hover the block to make the gutter interactive, then dispatch mousedown
  // on the gutter div (which has the onMouseDown handler)
  await pBlock.hover();
  const gutter = pBlock.locator('.rendered-gutter');
  await gutter.dispatchEvent('mousedown');

  // Wait for comment input to appear
  await page
    .locator('[data-testid="comment-input"]')
    .waitFor({ state: 'visible', timeout: 5000 });
});

When('I add a comment on the paragraph block', async () => {
  const page = getPage();
  // Click the gutter of the paragraph block
  const pBlock = page.locator('p.rendered-block').first();
  await pBlock.waitFor({ state: 'visible', timeout: 5000 });
  await pBlock.hover();
  const gutter = pBlock.locator('.rendered-gutter');
  await gutter.dispatchEvent('mousedown');

  // Wait for comment input, fill in, and submit
  await page
    .locator('[data-testid="comment-input"]')
    .waitFor({ state: 'visible', timeout: 5000 });
  await page
    .locator('[data-testid="comment-input"] textarea')
    .fill('Test rendered comment');
  await page.locator('[data-testid="add-comment-btn"]').click();
});

// ── Then steps ──

Then(
  'I should see a {string} toggle in the file header for {string}',
  async ({}, toggleLabel: string, filePath: string) => {
    const page = getPage();
    const header = page.locator(
      `[data-testid="file-header-${filePath}"]`
    );
    await expect(
      header.locator(`[aria-label="${toggleLabel} view"]`)
    ).toBeVisible({ timeout: 5000 });
  }
);

Then(
  'I should not see a {string} toggle in the file header for {string}',
  async ({}, toggleLabel: string, filePath: string) => {
    const page = getPage();
    const header = page.locator(
      `[data-testid="file-header-${filePath}"]`
    );
    await expect(
      header.locator(`[aria-label="${toggleLabel} view"]`)
    ).toHaveCount(0);
  }
);

Then('I should see the markdown rendered as formatted HTML', async () => {
  const page = getPage();
  const view = page.locator('.rendered-markdown-view');
  await expect(view).toBeVisible({ timeout: 5000 });
  // Should contain prose content (rendered HTML elements)
  const hasContent = await view.locator('h1, h2, h3, p, ul, ol, pre').count();
  expect(hasContent).toBeGreaterThan(0);
});

Then('I should see a gutter with line ranges', async () => {
  const page = getPage();
  const gutters = page.locator('.rendered-gutter');
  await expect(gutters.first()).toBeVisible({ timeout: 5000 });
  // Verify at least one gutter shows a line number or range
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

Then(
  'the comment input should open with the correct line range',
  async () => {
    const page = getPage();
    const commentInput = page.locator('[data-testid="comment-input"]');
    await expect(commentInput).toBeVisible({ timeout: 5000 });
    // The comment input header should show line information
    const text = await commentInput.textContent();
    expect(text).toMatch(/line/i);
  }
);

Then(
  'the comment should appear at the same source lines in the raw view',
  async () => {
    const page = getPage();
    // After switching to raw view, the comment should still be visible
    const comments = page.locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
    );
    await expect(comments.first()).toBeVisible({ timeout: 5000 });
    await expect(comments.first()).toContainText('Test rendered comment');
  }
);

Then(
  'the mermaid code block should render as an SVG diagram',
  async () => {
    const page = getPage();
    // Wait for mermaid to render (it's async)
    const svg = page.locator('.rendered-markdown-view svg');
    await expect(svg.first()).toBeVisible({ timeout: 10000 });
  }
);
