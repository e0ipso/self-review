/**
 * Webapp step definitions for Feature 03: Commenting System.
 * Same logic as Electron steps — only imports and Electron-specific steps differ.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { Page } from '@playwright/test';
import { getPage, triggerCommentIcon } from './app';

const { Given, When, Then } = createBdd();

/**
 * Root comments only: the bare `comment-` prefix also matches the gutter
 * icons, the composer and each comment's collapse toggle.
 */
const COMMENT_SELECTOR =
  '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])';

/**
 * Rendered replies only. `[data-testid^="reply-"]` on its own also matches
 * `reply-btn-<commentId>`, `reply-input` and `reply-actions`, so the anchor is
 * a direct child of a thread container; the `:not` then drops the edit
 * composer, which replaces a reply in place inside that same container.
 */
const REPLY_SELECTOR =
  '[data-testid^="thread-"] > [data-testid^="reply-"]:not([data-testid="reply-input"])';

function lastComment(page: Page) {
  return page.locator(COMMENT_SELECTOR).last();
}

/** The thread of the comment under test, in rendered order. */
function repliesOfLastComment(page: Page) {
  return lastComment(page).locator(REPLY_SELECTOR);
}

/** `index` is 1-based, matching the Gherkin "reply 1" wording. */
function replyAt(page: Page, index: number) {
  return repliesOfLastComment(page).nth(index - 1);
}

async function fillReplyInput(page: Page, text: string): Promise<void> {
  await page.locator('[data-testid="reply-input"] textarea').fill(text);
}

const activeDragFile: string | null = null;

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
  await page.waitForFunction(
    () => document.querySelector('[class*="bg-blue"]') !== null,
    { timeout: 3000 }
  ).catch(() => {});
}

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

// ── When: icon/gutter interactions ──

When(
  'I hover over the gutter of new line {int} in {string}',
  async ({}, line: number, filePath: string) => {
    const page = getPage();
    await page.locator(`[data-testid="new-line-${filePath}-${line}"]`).hover();
  }
);

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
  const comment = lastComment(getPage());
  if (action === 'Edit') {
    await comment.hover();
    await comment
      .locator('button:has(> .lucide-pencil), button:has-text("Edit")')
      .click();
  } else if (action === 'Delete') {
    await comment.hover();
    await comment
      .locator('button:has(> .lucide-trash-2), button:has-text("Delete")')
      .click();
  } else if (action === 'Reply') {
    // Addressed by test id rather than by the pencil/trash icon trick above,
    // because a thread's own per-reply controls sit inside this container.
    await comment.locator('[data-testid^="reply-btn-"]').click();
  }
});

When('I replace the text with {string}', async ({}, newText: string) => {
  const page = getPage();
  await page.locator('[data-testid="comment-input"] textarea').fill(newText);
});

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

// ── Then: assertions (identical to Electron steps) ──

Then('a comment input box should appear below that line', async () => {
  const page = getPage();
  await expect(page.locator('[data-testid="comment-input"]')).toBeVisible();
});

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

Then(
  'a comment should be displayed below new line {int} of {string}',
  async ({}, _line: number, _filePath: string) => {
    const page = getPage();
    const comments = page.locator(COMMENT_SELECTOR);
    expect(await comments.count()).toBeGreaterThan(0);
  }
);

Then(
  'a comment should be displayed below old line {int} of {string}',
  async ({}, _line: number, _filePath: string) => {
    const page = getPage();
    const comments = page.locator(COMMENT_SELECTOR);
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
  const comments = page.locator(COMMENT_SELECTOR);
  await expect(comments.last()).toContainText(expectedText);
});

Then('the comment header should show {string}', async ({}, text: string) => {
  const page = getPage();
  const comments = page.locator(COMMENT_SELECTOR);
  await expect(comments.last()).toContainText(text);
});

Then(
  'the file tree entry for {string} should show comment count {int}',
  async ({}, filePath: string, count: number) => {
    const page = getPage();
    const entry = page.locator(`[data-testid="file-entry-${filePath}"]`);
    if (count === 0) {
      const commentIndicator = entry.locator('.lucide-message-square');
      await expect(commentIndicator).toHaveCount(0);
    } else {
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
    const comments = page.locator(COMMENT_SELECTOR);
    await expect(comments.last().locator('.category-badge')).toContainText(category);
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
  const comments = page.locator(COMMENT_SELECTOR);
  await expect(comments).toHaveCount(0);
});

Then(
  'no comment should be displayed below new line {int}',
  async ({}, _line: number) => {
    const page = getPage();
    const comments = page.locator(COMMENT_SELECTOR);
    await expect(comments).toHaveCount(0);
  }
);

Then(
  'the comment body should render {string} as bold text',
  async ({}, text: string) => {
    const page = getPage();
    const comments = page.locator(COMMENT_SELECTOR);
    await expect(comments.last().locator('strong')).toContainText(text);
  }
);

Then('{string} as italic text', async ({}, text: string) => {
  const page = getPage();
  const comments = page.locator(COMMENT_SELECTOR);
  await expect(comments.last().locator('em')).toContainText(text);
});

// ── Replies ──

Given('I have replied {string} to that comment', async ({}, body: string) => {
  const page = getPage();
  const before = await repliesOfLastComment(page).count();
  await lastComment(page).locator('[data-testid^="reply-btn-"]').click();
  await fillReplyInput(page, body);
  await page.locator('[data-testid="add-reply-btn"]').click();
  // Settle before the next step composes another reply, so the ordering
  // assertion cannot pass on a half-rendered thread.
  await expect(repliesOfLastComment(page)).toHaveCount(before + 1);
});

When('I type {string} in the reply input', async ({}, text: string) => {
  await fillReplyInput(getPage(), text);
});

When('I replace the reply text with {string}', async ({}, text: string) => {
  await fillReplyInput(getPage(), text);
});

When('I click {string} in the reply input', async ({}, buttonText: string) => {
  const page = getPage();
  // "Reply" composes a new turn, "Update" commits an edit — same button.
  if (buttonText === 'Reply' || buttonText === 'Update') {
    await page.locator('[data-testid="add-reply-btn"]').click();
  } else if (buttonText === 'Cancel') {
    await page.locator('[data-testid="cancel-reply-btn"]').click();
  } else {
    throw new Error(`Unknown reply input action: ${buttonText}`);
  }
});

When('I click {string} on reply {int}', async ({}, action: string, index: number) => {
  const reply = replyAt(getPage(), index);
  await reply.hover();
  // The per-reply controls are `edit-reply-btn-<replyId>` /
  // `delete-reply-btn-<replyId>`; scoping to the reply itself avoids
  // re-deriving the id from the container's test id.
  if (action === 'Edit') {
    await reply.locator('[data-testid^="edit-reply-btn-"]').click();
  } else if (action === 'Delete') {
    await reply.locator('[data-testid^="delete-reply-btn-"]').click();
  } else {
    throw new Error(`Unknown reply action: ${action}`);
  }
});

Then('a reply input box should appear beneath that comment', async () => {
  const page = getPage();
  await expect(page.locator('[data-testid="reply-input"]')).toBeVisible();
});

Then('the comment should have {int} reply/replies', async ({}, count: number) => {
  await expect(repliesOfLastComment(getPage())).toHaveCount(count);
});

Then('reply {int} should show {string}', async ({}, index: number, text: string) => {
  await expect(replyAt(getPage(), index)).toContainText(text);
});

Then(
  'reply {int} should be attributed to {string}',
  async ({}, index: number, author: string) => {
    // The author span is the reply header's first element.
    await expect(replyAt(getPage(), index).locator('span').first()).toHaveText(
      author
    );
  }
);

Then(
  'the comment replies should read {string}, {string} in that order',
  async ({}, first: string, second: string) => {
    const page = getPage();
    const replies = repliesOfLastComment(page);
    // Settle first: allInnerTexts() is a one-shot read with no auto-retry.
    await expect(replies).toHaveCount(2);
    const bodies = await replies.allInnerTexts();
    expect(bodies[0]).toContain(first);
    expect(bodies[0]).not.toContain(second);
    expect(bodies[1]).toContain(second);
  }
);

Then(
  'the reply should become an editable input pre-filled with {string}',
  async ({}, text: string) => {
    const page = getPage();
    const textarea = page.locator('[data-testid="reply-input"] textarea');
    await expect(textarea).toBeVisible();
    await expect(textarea).toHaveValue(text);
  }
);
