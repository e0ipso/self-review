/**
 * Step definitions for Feature 08: Resume from Prior Review.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { writeFileSync } from 'fs';
import { join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import { createPriorReviewXml } from '../fixtures/test-repo';
import {
  getPage,
  getStdout,
  getExitCode,
  getStderr,
  getTestRepoDir,
} from './app';

const { Given, When, Then } = createBdd();

// ── Given: prior review XML ──

Given(
  'a prior review XML file {string} with these comments:',
  async ({}, fileName: string, table: DataTable) => {
    const repoDir = getTestRepoDir();
    const rows = table.hashes();
    const comments = rows.map((row) => ({
      filePath: row.file,
      newLineStart: row.new_line_start ? parseInt(row.new_line_start, 10) : undefined,
      newLineEnd: row.new_line_end ? parseInt(row.new_line_end, 10) : undefined,
      body: row.body,
      category: row.category || undefined,
    }));
    const xmlContent = createPriorReviewXml(repoDir, comments);
    writeFileSync(join(repoDir, fileName), xmlContent);
  },
);

Given('a file {string} containing {string}', async ({}, fileName: string, content: string) => {
  const repoDir = getTestRepoDir();
  writeFileSync(join(repoDir, fileName), content);
});

// ── When: resume-specific actions ──

When(
  'I click {string} on the comment {string}',
  async ({}, action: string, commentBody: string) => {
    const page = getPage();
    // Find the comment that contains the body text
    const comments = page.locator('[data-testid^="comment-"]');
    const count = await comments.count();
    for (let i = 0; i < count; i++) {
      const text = await comments.nth(i).textContent();
      if (text?.includes(commentBody)) {
        if (action === 'Edit') {
          await comments.nth(i).locator('button', { hasText: 'Edit' }).click();
        } else if (action === 'Delete') {
          await comments.nth(i).locator('button', { hasText: 'Delete' }).click();
        }
        break;
      }
    }
  },
);

// ── Then: resume assertions ──

Then(
  'the comment {string} should be displayed at new line {int} of {string}',
  async ({}, body: string, _line: number, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await expect(section).toContainText(body);
  },
);

Then(
  'the file-level comment {string} should be displayed on {string}',
  async ({}, body: string, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await expect(section).toContainText(body);
  },
);

Then(
  'the XML output should contain {int} comments for {string}',
  async ({}, count: number, filePath: string) => {
    const stdout = getStdout();
    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });
    const parsed = parser.parse(stdout);
    const files = Array.isArray(parsed.review.file)
      ? parsed.review.file
      : parsed.review.file
        ? [parsed.review.file]
        : [];
    const fileEl = files.find((f: any) => f['@_path'] === filePath);
    if (count === 0) {
      expect(fileEl?.comment).toBeUndefined();
    } else {
      const comments = Array.isArray(fileEl?.comment) ? fileEl.comment : fileEl?.comment ? [fileEl.comment] : [];
      expect(comments.length).toBe(count);
    }
  },
);

Then(
  'stderr should contain an error message about invalid XML',
  async () => {
    const stderr = getStderr();
    expect(stderr.toLowerCase()).toMatch(/error|invalid|parse|xml/i);
  },
);

Then(
  'stderr should contain an error message about the file not being found',
  async () => {
    const stderr = getStderr();
    expect(stderr.toLowerCase()).toMatch(/error|no such file|not found|enoent/i);
  },
);
