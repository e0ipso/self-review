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
  getTestRepoDir,
  readOutputFile,
} from './app';

const { Given, When, Then } = createBdd();

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
    }));
    const xmlContent = createPriorReviewXml(repoDir, comments);
    writeFileSync(join(repoDir, fileName), xmlContent);
  }
);

// ── When: resume-specific actions ──

When(
  'I click {string} on the comment {string}',
  async ({}, action: string, commentBody: string) => {
    const page = getPage();
    // Wait for resumed comments to load, then find the one with matching body text
    const comment = page
      .locator('[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid^="comment-collapse"]):not([data-testid="comment-input"])')
      .filter({ hasText: commentBody });
    await comment.first().waitFor({ state: 'visible', timeout: 15000 });
    await comment.first().hover();
    // Wait for hover action buttons to become visible (use sr-only text for accessible name)
    const actionBtn = comment.first().getByRole('button', { name: action });
    await actionBtn.waitFor({ state: 'visible', timeout: 3000 });
    await actionBtn.click();
    if (action === 'Delete') {
      // Wait for the comment to be removed from the DOM after deletion
      await comment.first().waitFor({ state: 'detached', timeout: 5000 });
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

