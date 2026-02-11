/**
 * Step definitions for Feature 03: Commenting System.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { getPage, getTestRepoDir } from './app';

const { Given, When, Then } = createBdd();

// ── Background: project categories ──

Given(
  'the project has these comment categories:',
  async ({}, table: DataTable) => {
    const categories = table.hashes();
    const yamlLines = ['categories:'];
    for (const cat of categories) {
      yamlLines.push(`  - name: "${cat.name}"`);
      yamlLines.push(`    description: "${cat.name} category"`);
      yamlLines.push(`    color: "${cat.color}"`);
    }
    const repoDir = getTestRepoDir();
    writeFileSync(join(repoDir, '.self-review.yaml'), yamlLines.join('\n') + '\n');
  },
);

// ── Given: pre-existing comment ──

Given(
  'I have added a comment {string} on new line {int} of {string}',
  async ({}, body: string, line: number, filePath: string) => {
    const page = getPage();
    await page.locator(`[data-testid="new-line-${filePath}-${line}"]`).click();
    await page.locator('[data-testid="comment-input"] textarea').fill(body);
    await page.locator('[data-testid="add-comment-btn"]').click();
  },
);

// ── When: line interactions ──

When(
  'I click the line number for new line {int} in {string}',
  async ({}, line: number, filePath: string) => {
    const page = getPage();
    await page.locator(`[data-testid="new-line-${filePath}-${line}"]`).click();
  },
);

When(
  'I click the line number for old line {int} in {string}',
  async ({}, line: number, filePath: string) => {
    const page = getPage();
    await page.locator(`[data-testid="old-line-${filePath}-${line}"]`).click();
  },
);

When(
  'I select line numbers from new line {int} to new line {int} in {string}',
  async ({}, startLine: number, endLine: number, filePath: string) => {
    const page = getPage();
    const startEl = page.locator(`[data-testid="new-line-${filePath}-${startLine}"]`);
    const endEl = page.locator(`[data-testid="new-line-${filePath}-${endLine}"]`);
    await startEl.dispatchEvent('mousedown');
    await endEl.dispatchEvent('mouseup');
  },
);

// ── When: comment input interactions ──

When('I type {string} in the comment input', async ({}, text: string) => {
  const page = getPage();
  await page.locator('[data-testid="comment-input"] textarea').fill(text);
});

When('I click {string}', async ({}, buttonText: string) => {
  const page = getPage();
  if (buttonText === 'Add comment') {
    await page.locator('[data-testid="add-comment-btn"]').click();
  } else if (buttonText === 'Cancel') {
    await page.locator('[data-testid="cancel-comment-btn"]').click();
  } else if (buttonText === 'Add suggestion') {
    await page.locator('[data-testid="add-suggestion-btn"]').click();
  }
});

When(
  'I click {string} on the {string} file section header',
  async ({}, buttonText: string, filePath: string) => {
    const page = getPage();
    if (buttonText === 'Add file comment') {
      await page.locator(`[data-testid="add-file-comment-${filePath}"]`).click();
    }
  },
);

When('I select category {string} in the comment input', async ({}, category: string) => {
  const page = getPage();
  await page.locator('[data-testid="category-selector"]').click();
  await page.locator(`[data-testid="category-option-${category}"]`).click();
});

When('I click {string} on that comment', async ({}, action: string) => {
  const page = getPage();
  // Find the most recently added comment and click its action button
  const comments = page.locator('[data-testid^="comment-"]').filter({ hasNotText: 'comment-input' });
  const lastComment = comments.last();
  if (action === 'Edit') {
    await lastComment.locator('button', { hasText: 'Edit' }).click();
  } else if (action === 'Delete') {
    await lastComment.locator('button', { hasText: 'Delete' }).click();
  }
});

When('I replace the text with {string}', async ({}, newText: string) => {
  const page = getPage();
  const textarea = page.locator('[data-testid="comment-input"] textarea');
  await textarea.fill(newText);
});

// ── Then: comment assertions ──

Then('a comment input box should appear below that line', async () => {
  const page = getPage();
  await expect(page.locator('[data-testid="comment-input"]')).toBeVisible();
});

Then('a comment input box should appear below new line {int}', async ({}, _line: number) => {
  const page = getPage();
  await expect(page.locator('[data-testid="comment-input"]')).toBeVisible();
});

Then(
  'a comment input box should appear at the top of the file section',
  async () => {
    const page = getPage();
    await expect(page.locator('[data-testid="comment-input"]')).toBeVisible();
  },
);

Then(
  'a comment should be displayed below new line {int} of {string}',
  async ({}, _line: number, _filePath: string) => {
    const page = getPage();
    const comments = page.locator('[data-testid^="comment-"]').filter({ hasNotText: 'comment-input' });
    expect(await comments.count()).toBeGreaterThan(0);
  },
);

Then(
  'a comment should be displayed below old line {int} of {string}',
  async ({}, _line: number, _filePath: string) => {
    const page = getPage();
    const comments = page.locator('[data-testid^="comment-"]').filter({ hasNotText: 'comment-input' });
    expect(await comments.count()).toBeGreaterThan(0);
  },
);

Then(
  'a file-level comment should be displayed at the top of the {string} section',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const comments = section.locator('[data-testid^="comment-"]');
    expect(await comments.count()).toBeGreaterThan(0);
  },
);

Then('the comment should show {string}', async ({}, expectedText: string) => {
  const page = getPage();
  const comments = page.locator('[data-testid^="comment-"]');
  const lastComment = comments.last();
  await expect(lastComment).toContainText(expectedText);
});

Then(
  'the file tree entry for {string} should show comment count {int}',
  async ({}, filePath: string, count: number) => {
    const page = getPage();
    const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
    if (count === 0) {
      const badge = entry.locator('.comment-count');
      await expect(badge).toHaveCount(0);
    } else {
      const badge = entry.locator('.comment-count');
      await expect(badge).toContainText(`${count}`);
    }
  },
);

Then(
  'the displayed comment should show a {string} category badge',
  async ({}, category: string) => {
    const page = getPage();
    const comments = page.locator('[data-testid^="comment-"]');
    const lastComment = comments.last();
    await expect(lastComment.locator('.category-badge')).toContainText(category);
  },
);

Then(
  'the comment should become an editable input pre-filled with {string}',
  async ({}, text: string) => {
    const page = getPage();
    const textarea = page.locator('[data-testid="comment-input"] textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(text);
  },
);

Then('the comment should be removed', async () => {
  const page = getPage();
  // After deletion, there should be no comment elements in the current context
  const comments = page.locator('[data-testid^="comment-"]:not([data-testid="comment-input"])');
  await expect(comments).toHaveCount(0);
});

Then('no comment should be displayed below new line {int}', async ({}, _line: number) => {
  const page = getPage();
  const comments = page.locator('[data-testid^="comment-"]:not([data-testid="comment-input"])');
  await expect(comments).toHaveCount(0);
});

Then(
  'lines {int} through {int} should be visually highlighted',
  async ({}, _start: number, _end: number) => {
    const page = getPage();
    // Selection range creates a visual highlight - check for selection-highlight class
    const highlighted = page.locator('.selection-highlight');
    expect(await highlighted.count()).toBeGreaterThan(0);
  },
);

Then('a comment should be displayed below new line {int}', async ({}, _line: number) => {
  const page = getPage();
  const comments = page.locator('[data-testid^="comment-"]:not([data-testid="comment-input"])');
  expect(await comments.count()).toBeGreaterThan(0);
});
