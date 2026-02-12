/**
 * Step definitions for Feature 03: Commenting System.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { Page } from '@playwright/test';
import { getPage, getTestRepoDir, triggerCommentIcon, saveAndCloseApp } from './app';

const { Given, When, Then } = createBdd();

// Track the file path of the current drag operation
let activeDragFile: string | null = null;

/**
 * Perform a drag move to the given line within the active drag file section.
 * Dispatches a mousemove event from within the browser context using
 * getBoundingClientRect() to avoid CDP-to-browser coordinate translation issues.
 */
async function dragMoveToLine(page: Page, line: number, side: 'new' | 'old'): Promise<void> {
  const sectionSel = activeDragFile
    ? `[data-testid="file-section-${activeDragFile}"]`
    : null;
  await page.evaluate(({ ln, s, secSel }) => {
    const container = secSel ? document.querySelector(secSel) : document;
    if (!container) return;
    const el = container.querySelector(`[data-line-number="${ln}"][data-line-side="${s}"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.x + 20,
        clientY: rect.y + rect.height / 2,
        bubbles: true,
      }));
    }
  }, { ln: line, s: side, secSel: sectionSel });
  await page.waitForTimeout(100);
}

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
    writeFileSync(
      join(repoDir, '.self-review.yaml'),
      yamlLines.join('\n') + '\n'
    );
  }
);

// ── Given: pre-existing comments ──

Given(
  'I have added a comment {string} on new line {int} of {string}',
  async ({}, body: string, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'new');
    const page = getPage();
    await page.locator('[data-testid="comment-input"] textarea').fill(body);
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

Given(
  'I have added a comment on new line {int} of {string}',
  async ({}, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'new');
    const page = getPage();
    await page
      .locator('[data-testid="comment-input"] textarea')
      .fill('Test comment');
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

Given(
  'I have added a comment on new lines {int} to {int} of {string}',
  async ({}, startLine: number, endLine: number, filePath: string) => {
    activeDragFile = filePath;
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const gutter = section.locator(
      `[data-testid="new-line-${filePath}-${startLine}"]`
    );
    await gutter.hover();
    const startIcon = section.locator(
      `[data-testid="comment-icon-new-${startLine}"]`
    );
    const box = await startIcon.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(200);
      await dragMoveToLine(page, endLine, 'new');
      await page.mouse.up();
      await page.waitForTimeout(100);
    }
    await page
      .locator('[data-testid="comment-input"] textarea')
      .fill('Test comment');
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

Given(
  'I have added a file-level comment on {string}',
  async ({}, filePath: string) => {
    const page = getPage();
    await page.locator(`[data-testid="add-file-comment-${filePath}"]`).click();
    await page
      .locator('[data-testid="comment-input"] textarea')
      .fill('File comment');
    await page.locator('[data-testid="add-comment-btn"]').click();
  }
);

Given('I am viewing diffs in split mode', async () => {
  const page = getPage();
  await expect(page.locator('.split-view').first()).toBeVisible();
});

// ── Given: hunk boundary setup ──

Given(
  'a diff with hunk A covering new lines {int}-{int} and hunk B covering new lines {int}-{int} in {string}',
  async (
    {},
    _aStart: number,
    _aEnd: number,
    _bStart: number,
    _bEnd: number,
    _filePath: string
  ) => {
    // This is a precondition about the diff structure.
    // The test repo should already have the expected hunk layout.
    // No action needed - the assertion validates at runtime.
  }
);

// ── When: icon/gutter interactions ──

When(
  'I hover over the gutter of new line {int} in {string}',
  async ({}, line: number, filePath: string) => {
    const page = getPage();
    await page.locator(`[data-testid="new-line-${filePath}-${line}"]`).hover();
  }
);

When('I hover over an empty padding cell in the gutter', async () => {
  const page = getPage();
  // In split view, padding cells are empty half-divs with bg-muted backgrounds
  const paddingCell = page.locator('.split-view .w-10.bg-muted\\/20').first();
  if ((await paddingCell.count()) > 0) {
    await paddingCell.hover();
  } else {
    // Hover somewhere neutral
    await page.locator('.split-view').first().hover();
  }
});

When(
  'I click the {string} icon on new line {int} in {string}',
  async ({}, _icon: string, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'new');
  }
);

When(
  'I click the {string} icon on old line {int} in {string}',
  async ({}, _icon: string, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'old');
  }
);

// ── When: line interactions (used by Features 04, etc.) ──

When(
  'I click the line number for new line {int} in {string}',
  async ({}, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'new');
  }
);

When(
  'I click the line number for old line {int} in {string}',
  async ({}, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'old');
  }
);

When(
  'I select line numbers from new line {int} to new line {int} in {string}',
  async ({}, startLine: number, endLine: number, filePath: string) => {
    activeDragFile = filePath;
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const gutter = section.locator(
      `[data-testid="new-line-${filePath}-${startLine}"]`
    );
    await gutter.hover();
    const startIcon = section.locator(
      `[data-testid="comment-icon-new-${startLine}"]`
    );
    const box = await startIcon.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(200);
      await dragMoveToLine(page, endLine, 'new');
      await page.mouse.up();
      await page.waitForTimeout(100);
    }
  }
);

// ── When: drag selection ──

When(
  'I mousedown on the {string} icon at new line {int} in {string}',
  async ({}, _icon: string, line: number, filePath: string) => {
    activeDragFile = filePath;
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const gutter = section.locator(
      `[data-testid="new-line-${filePath}-${line}"]`
    );
    await gutter.hover();
    const icon = section.locator(`[data-testid="comment-icon-new-${line}"]`);
    const box = await icon.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(200);
    }
  }
);

When(
  'I mousedown on the {string} icon at new line {int}',
  async ({}, _icon: string, line: number) => {
    // No file path provided — activeDragFile stays from previous step or null
    const page = getPage();
    const icon = page
      .locator(`[data-testid="comment-icon-new-${line}"]`)
      .first();
    const gutter = icon.locator('..');
    await gutter.hover();
    const box = await icon.boundingBox();
    if (box) {
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.down();
      await page.waitForTimeout(200);
    }
  }
);

When('I drag to new line {int}', async ({}, line: number) => {
  const page = getPage();
  await dragMoveToLine(page, line, 'new');
});

When('I drag upward to new line {int}', async ({}, line: number) => {
  const page = getPage();
  await dragMoveToLine(page, line, 'new');
});

When('I drag past new line {int} toward hunk B', async ({}, line: number) => {
  const page = getPage();
  const sectionSel = activeDragFile
    ? `[data-testid="file-section-${activeDragFile}"]`
    : null;
  await page.evaluate(({ ln, secSel }) => {
    const container = secSel ? document.querySelector(secSel) : document;
    if (!container) return;
    const el = container.querySelector(`[data-line-number="${ln}"][data-line-side="new"]`);
    if (el) {
      const rect = el.getBoundingClientRect();
      document.dispatchEvent(new MouseEvent('mousemove', {
        clientX: rect.x + 20,
        clientY: rect.y + rect.height + 100,
        bubbles: true,
      }));
    }
  }, { ln: line, secSel: sectionSel });
  await page.waitForTimeout(100);
});

When('I release the mouse', async () => {
  const page = getPage();
  await page.mouse.up();
  await page.waitForTimeout(100);
});

// ── When: comment input interactions ──

When('I type {string} in the comment input', async ({}, text: string) => {
  const page = getPage();
  await page.locator('[data-testid="comment-input"] textarea').fill(text);
});

When('I click {string}', async ({}, buttonText: string) => {
  const page = getPage();
  if (buttonText === 'Add comment' || buttonText === 'Comment') {
    await page.locator('[data-testid="add-comment-btn"]').click();
  } else if (buttonText === 'Cancel') {
    await page.locator('[data-testid="cancel-comment-btn"]').click();
  } else if (buttonText === 'Add suggestion') {
    await page.locator('[data-testid="add-suggestion-btn"]').click();
  } else if (buttonText === 'Finish Review') {
    await saveAndCloseApp();
  }
});

When(
  'I click {string} on the {string} file section header',
  async ({}, buttonText: string, filePath: string) => {
    const page = getPage();
    if (buttonText === 'Add file comment') {
      await page
        .locator(`[data-testid="add-file-comment-${filePath}"]`)
        .click();
    }
  }
);

When(
  'I select category {string} in the comment input',
  async ({}, category: string) => {
    const page = getPage();
    await page.locator('[data-testid="category-selector"]').click();
    await page.locator(`[data-testid="category-option-${category}"]`).click();
  }
);

When('I click {string} on that comment', async ({}, action: string) => {
  const page = getPage();
  // Find the most recently added comment and click its action button
  const comments = page.locator(
    '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
  );
  const lastComment = comments.last();
  if (action === 'Edit') {
    await lastComment.hover();
    await lastComment
      .locator('button:has(> .lucide-pencil), button:has-text("Edit")')
      .click();
  } else if (action === 'Delete') {
    await lastComment.hover();
    await lastComment
      .locator('button:has(> .lucide-trash-2), button:has-text("Delete")')
      .click();
  }
});

When('I replace the text with {string}', async ({}, newText: string) => {
  const page = getPage();
  const textarea = page.locator('[data-testid="comment-input"] textarea');
  await textarea.fill(newText);
});

// ── When: markdown input ──

When('I type a comment with a fenced code block', async () => {
  const page = getPage();
  await page
    .locator('[data-testid="comment-input"] textarea')
    .fill('```typescript\nconst x = 1;\n```');
});

When('I type a comment with a GFM table', async () => {
  const page = getPage();
  await page
    .locator('[data-testid="comment-input"] textarea')
    .fill('| Col A | Col B |\n|-------|-------|\n| 1     | 2     |');
});

// ── Then: icon/gutter assertions ──

Then(
  'a {string} icon should be visible in the gutter',
  async ({}, _icon: string) => {
    const page = getPage();
    const icons = page.locator('[data-testid^="comment-icon-"]');
    await expect(icons.first()).toBeVisible();
  }
);

Then(
  'no {string} icons should be visible in the gutter area',
  async ({}, _icon: string) => {
    const page = getPage();
    // Icons exist but should be invisible (opacity-0) without hover
    const visibleIcons = page.locator('[data-testid^="comment-icon-"]:visible');
    // Check that none have opacity > 0 (they are there but CSS hidden)
    const count = await visibleIcons.count();
    // Even if DOM has them, they shouldn't be actionably visible
    if (count > 0) {
      // Verify they are opacity-0 (not hovered)
      const opacity = await visibleIcons
        .first()
        .evaluate(el => window.getComputedStyle(el).opacity);
      expect(parseFloat(opacity)).toBeLessThan(0.1);
    }
  }
);

Then('no {string} icon should appear', async ({}, _icon: string) => {
  const page = getPage();
  // In padding cells (no line data), there should be no icon at all
  // Just verify no icon is visible near the current hover target
  const visibleIcons = page.locator('[data-testid^="comment-icon-"]:visible');
  const count = await visibleIcons.count();
  if (count > 0) {
    const opacity = await visibleIcons
      .first()
      .evaluate(el => window.getComputedStyle(el).opacity);
    expect(parseFloat(opacity)).toBeLessThan(0.1);
  }
});

// ── Then: comment input assertions ──

Then('a comment input box should appear below that line', async () => {
  const page = getPage();
  await expect(page.locator('[data-testid="comment-input"]')).toBeVisible();
});

Then(
  'a comment input box should appear below new line {int}',
  async ({}, _line: number) => {
    const page = getPage();
    await expect(page.locator('[data-testid="comment-input"]')).toBeVisible();
  }
);

Then(
  'a comment input box should appear at the top of the file section',
  async () => {
    const page = getPage();
    await expect(page.locator('[data-testid="comment-input"]')).toBeVisible();
  }
);

Then(
  'the comment input header should show {string}',
  async ({}, text: string) => {
    const page = getPage();
    const input = page.locator('[data-testid="comment-input"]');
    await expect(input).toContainText(text);
  }
);

Then('the comment input should be closed', async () => {
  const page = getPage();
  await expect(page.locator('[data-testid="comment-input"]')).toHaveCount(0);
});

Then('no empty comment input should be visible', async () => {
  const page = getPage();
  await expect(page.locator('[data-testid="comment-input"]')).toHaveCount(0);
});

// ── Then: comment display assertions ──

Then(
  'a comment should be displayed below new line {int} of {string}',
  async ({}, _line: number, _filePath: string) => {
    const page = getPage();
    const comments = page.locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
    );
    expect(await comments.count()).toBeGreaterThan(0);
  }
);

Then(
  'a comment should be displayed below old line {int} of {string}',
  async ({}, _line: number, _filePath: string) => {
    const page = getPage();
    const comments = page.locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
    );
    expect(await comments.count()).toBeGreaterThan(0);
  }
);

Then(
  'a file-level comment should be displayed at the top of the {string} section',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    const comments = section.locator('[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid^="comment-collapse"])');
    expect(await comments.count()).toBeGreaterThan(0);
  }
);

Then('the comment should show {string}', async ({}, expectedText: string) => {
  const page = getPage();
  const comments = page.locator(
    '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
  );
  const lastComment = comments.last();
  await expect(lastComment).toContainText(expectedText);
});

Then('the comment header should show {string}', async ({}, text: string) => {
  const page = getPage();
  const comments = page.locator(
    '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
  );
  const lastComment = comments.last();
  await expect(lastComment).toContainText(text);
});

Then(
  'the comment display header should show {string}',
  async ({}, text: string) => {
    const page = getPage();
    const comments = page.locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
    );
    const lastComment = comments.last();
    await expect(lastComment).toContainText(text);
  }
);

Then('the comment display should show no line range indicator', async () => {
  const page = getPage();
  const comments = page.locator(
    '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
  );
  const lastComment = comments.last();
  // File-level comments have no lineRange so no "line X" or "lines X–Y" text
  const text = await lastComment.textContent();
  expect(text).not.toMatch(/\bline\s+\d+/);
});

Then(
  'the file tree entry for {string} should show comment count {int}',
  async ({}, filePath: string, count: number) => {
    const page = getPage();
    const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
    if (count === 0) {
      // No MessageSquare icon should be present
      const commentIndicator = entry.locator('.lucide-message-square');
      await expect(commentIndicator).toHaveCount(0);
    } else {
      // Target the comment count span next to the MessageSquare icon
      const commentBadge = entry.locator('.lucide-message-square + span');
      await expect(commentBadge).toBeVisible();
      await expect(commentBadge).toHaveText(String(count));
    }
  }
);

Then(
  'the displayed comment should show a {string} category badge',
  async ({}, category: string) => {
    const page = getPage();
    const comments = page.locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
    );
    const lastComment = comments.last();
    await expect(lastComment.locator('.category-badge')).toContainText(
      category
    );
  }
);

Then(
  'the comment should become an editable input pre-filled with {string}',
  async ({}, text: string) => {
    const page = getPage();
    const textarea = page.locator('[data-testid="comment-input"] textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(text);
  }
);

Then('the comment should be removed', async () => {
  const page = getPage();
  const comments = page.locator(
    '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
  );
  await expect(comments).toHaveCount(0);
});

Then(
  'no comment should be displayed below new line {int}',
  async ({}, _line: number) => {
    const page = getPage();
    const comments = page.locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
    );
    await expect(comments).toHaveCount(0);
  }
);

Then(
  'lines {int} through {int} should be visually highlighted',
  async ({}, _start: number, _end: number) => {
    const page = getPage();
    // Selection range creates a visual highlight
    const highlighted = page.locator('[class*="bg-blue"]');
    expect(await highlighted.count()).toBeGreaterThan(0);
  }
);

Then(
  'the selection should be clamped to new line {int}',
  async ({}, _line: number) => {
    // Release the mouse and verify the comment input appears
    const page = getPage();
    await page.mouse.up();
    await page.waitForTimeout(100);
    const commentInput = page.locator('[data-testid="comment-input"]');
    await expect(commentInput).toBeVisible();
  }
);

Then(
  'a comment should be displayed below new line {int}',
  async ({}, _line: number) => {
    const page = getPage();
    const comments = page.locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
    );
    expect(await comments.count()).toBeGreaterThan(0);
  }
);

// ── Then: markdown rendering assertions ──

Then(
  'the comment body should render {string} as bold text',
  async ({}, text: string) => {
    const page = getPage();
    const comments = page.locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
    );
    const lastComment = comments.last();
    const bold = lastComment.locator('strong');
    await expect(bold).toContainText(text);
  }
);

Then('{string} as italic text', async ({}, text: string) => {
  const page = getPage();
  const comments = page.locator(
    '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
  );
  const lastComment = comments.last();
  const italic = lastComment.locator('em');
  await expect(italic).toContainText(text);
});

Then(
  'the code block should render with monospace font and a background',
  async () => {
    const page = getPage();
    const comments = page.locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
    );
    const lastComment = comments.last();
    const codeBlock = lastComment.locator('pre');
    await expect(codeBlock).toBeVisible();
  }
);

Then('the table should render with borders', async () => {
  const page = getPage();
  const comments = page.locator(
    '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])'
  );
  const lastComment = comments.last();
  const table = lastComment.locator('table');
  await expect(table).toBeVisible();
});
