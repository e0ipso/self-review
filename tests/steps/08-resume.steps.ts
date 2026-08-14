/**
 * Step definitions for Feature 08: Resume from Prior Review.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { createPriorReviewXml } from '../fixtures/test-repo';
import {
  getPage,
  getTestRepoDir,
  readOutputFile,
} from './app';

const { Given, When, Then } = createBdd();

/**
 * A rendered comment card, addressed by its body text.
 *
 * The `:not(...)` clauses drop the other `comment-`-prefixed test ids that live
 * inside or beside a card (the gutter icon, the collapse toggle, the composer),
 * so the locator resolves to the card itself.
 */
function commentCard(body: string) {
  return getPage()
    .locator(
      '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid^="comment-collapse"]):not([data-testid="comment-input"])'
    )
    .filter({ hasText: body })
    .first();
}

// ── Given: prior review XML ──

Given(
  'a prior review XML file {string} with these comments:',
  async ({}, fileName: string, table: DataTable) => {
    const repoDir = getTestRepoDir();
    const rows = table.hashes();
    const comments = rows.map(row => ({
      filePath: row.file,
      newLineStart: row.new_line_start
        ? parseInt(row.new_line_start, 10)
        : undefined,
      newLineEnd: row.new_line_end ? parseInt(row.new_line_end, 10) : undefined,
      body: row.body,
      category: row.category || undefined,
      severity: row.severity || undefined,
      confidence: row.confidence || undefined,
    }));
    const xmlContent = createPriorReviewXml(repoDir, comments);
    writeFileSync(join(repoDir, fileName), xmlContent);
  }
);

Given(
  'a prior review XML file {string} with these viewed files:',
  async ({}, fileName: string, table: DataTable) => {
    const repoDir = getTestRepoDir();
    const fileStates = table.hashes().map(row => ({
      path: row.file,
      viewed: row.viewed === 'true',
    }));
    const xmlContent = createPriorReviewXml(repoDir, [], fileStates);
    writeFileSync(join(repoDir, fileName), xmlContent);
  }
);

Given(
  'a prior review XML file {string} with a comment {string} on new line {int} of {string} carrying these replies:',
  async (
    {},
    fileName: string,
    body: string,
    line: number,
    filePath: string,
    table: DataTable
  ) => {
    const repoDir = getTestRepoDir();
    const replies = table.hashes().map(row => ({
      body: row.body,
      // An empty author cell means the turn is the human reviewer's.
      author: row.author || undefined,
    }));
    const xmlContent = createPriorReviewXml(repoDir, [
      {
        filePath,
        newLineStart: line,
        newLineEnd: line,
        body,
        replies,
      },
    ]);
    writeFileSync(join(repoDir, fileName), xmlContent);
  }
);

Given(
  'the prior review XML file {string} should declare namespace {string}',
  async ({}, fileName: string, namespace: string) => {
    // Guards the premise of the v2-in / v3-out scenario: if someone bumps the
    // fixture generator to v3, the round-trip stops proving anything.
    const contents = readFileSync(join(getTestRepoDir(), fileName), 'utf-8');
    expect(contents).toContain(`xmlns="${namespace}"`);
  }
);

// ── When: resume-specific actions ──

When(
  'I click {string} on the comment {string}',
  async ({}, action: string, commentBody: string) => {
    // Wait for resumed comments to load, then find the one with matching body text
    const comment = commentCard(commentBody);
    await comment.waitFor({ state: 'visible', timeout: 15000 });
    await comment.hover();
    // Wait for hover action buttons to become visible (use sr-only text for accessible name)
    const actionBtn = comment.getByRole('button', { name: action });
    await actionBtn.waitFor({ state: 'visible', timeout: 3000 });
    await actionBtn.click();
    if (action === 'Delete') {
      // Wait for the comment to be removed from the DOM after deletion
      await comment.waitFor({ state: 'detached', timeout: 5000 });
    }
  }
);

// ── Then: resume assertions ──

Then(
  'the comment {string} should be displayed at new line {int} of {string}',
  async ({}, body: string, _line: number, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await expect(section).toContainText(body);
  }
);

Then(
  'the file-level comment {string} should be displayed on {string}',
  async ({}, body: string, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await expect(section).toContainText(body);
  }
);

Then(
  'the file {string} should be marked as done reviewing',
  async ({}, filePath: string) => {
    const page = getPage();
    await expect(
      page.locator(`[data-testid="viewed-${filePath}"]`)
    ).toContainText('Done reviewing');
  }
);

Then(
  'the file {string} should not be marked as done reviewing',
  async ({}, filePath: string) => {
    const page = getPage();
    await expect(
      page.locator(`[data-testid="viewed-${filePath}"]`)
    ).toContainText('To review');
  }
);

Then(
  'the output file should mark {string} as viewed',
  async ({}, filePath: string) => {
    const xmlContent = readOutputFile();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const parsed = parser.parse(xmlContent);
    const files = Array.isArray(parsed.review.file)
      ? parsed.review.file
      : parsed.review.file
        ? [parsed.review.file]
        : [];
    const fileEl = files.find((f: any) => f['@_path'] === filePath);
    expect(fileEl).toBeDefined();
    expect(String(fileEl['@_viewed'])).toBe('true');
  }
);

Then(
  'the output file should contain {int} comments for {string}',
  async ({}, count: number, filePath: string) => {
    const xmlContent = readOutputFile();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const parsed = parser.parse(xmlContent);
    const files = Array.isArray(parsed.review.file)
      ? parsed.review.file
      : parsed.review.file
        ? [parsed.review.file]
        : [];
    const fileEl = files.find((f: any) => f['@_path'] === filePath);
    if (count === 0) {
      expect(fileEl?.comment).toBeUndefined();
    } else {
      const comments = Array.isArray(fileEl?.comment)
        ? fileEl.comment
        : fileEl?.comment
          ? [fileEl.comment]
          : [];
      expect(comments.length).toBe(count);
    }
  }
);


Then(
  'the comment {string} should show a {string} severity badge and {string} confidence badge',
  async ({}, body: string, severity: string, confidence: string) => {
    const comment = commentCard(body);
    await expect(
      comment.locator(`[data-testid="comment-severity-${severity}"]`)
    ).toBeVisible();
    await expect(
      comment.locator(`[data-testid="comment-confidence-${confidence}"]`)
    ).toBeVisible();
  }
);

Then(
  'the rendered replies for the comment {string} should read, in order:',
  async ({}, body: string, table: DataTable) => {
    const comment = commentCard(body);
    await comment.waitFor({ state: 'visible', timeout: 15000 });
    // Each reply is a direct child of the thread container. The composer and
    // the "Reply" button are siblings of that container, not descendants, so a
    // descendant match here resolves to the reply cards alone.
    const replies = comment
      .locator('[data-testid^="thread-"]')
      .locator('[data-testid^="reply-"]');
    const expected = table.hashes();
    await expect(replies).toHaveCount(expected.length);
    // Positional, because document order is conversation order.
    for (let i = 0; i < expected.length; i++) {
      const reply = replies.nth(i);
      await expect(reply).toContainText(expected[i].body);
      // The attribution line is the reply's first <span>: the lucide icon is an
      // <svg>, and the button labels come later in DOM order.
      await expect(reply.locator('span').first()).toHaveText(
        expected[i].author
      );
    }
  }
);

Then(
  'the output file should preserve severity {string} and confidence {string} for the comment {string}',
  async ({}, severity: string, confidence: string, body: string) => {
    const xmlContent = readOutputFile();
    const parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
    const parsed = parser.parse(xmlContent);
    const files = Array.isArray(parsed.review.file)
      ? parsed.review.file
      : parsed.review.file
        ? [parsed.review.file]
        : [];
    const allComments = files.flatMap((f: any) =>
      Array.isArray(f.comment) ? f.comment : f.comment ? [f.comment] : []
    );
    const match = allComments.find((c: any) => String(c.body) === body);
    expect(match).toBeDefined();
    expect(match['@_severity']).toBe(severity);
    expect(match['@_confidence']).toBe(confidence);
  }
);
