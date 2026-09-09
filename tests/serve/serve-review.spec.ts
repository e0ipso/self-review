/**
 * Serve mode, end to end: a real fixture repository, the built executable run
 * as an ordinary child process, a real browser, and the document it leaves on
 * disk.
 *
 * The assertion is the file. `POST /api/review` answers 200 once the state is
 * on the session, and the process serializes and writes only afterwards — so
 * a test that stopped at the status code would pass against a program that
 * never wrote anything at all. Everything asserted below is read back from
 * the output path after the process has exited.
 */
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestRepo } from '../fixtures/test-repo';
import { triggerCommentIcon } from '../fixtures/comment-actions';
import { startServe, ServeProcess } from './serve-process';
import {
  commentsFor,
  filesOf,
  readReviewDocument,
  validateAgainstV3Xsd,
} from './review-document';

/**
 * The fixture's unstaged changes: four tracked files and two untracked ones.
 * The output file lives outside the repository so it cannot become a seventh.
 */
const FIXTURE_FILE_COUNT = 6;
const COMMENTED_FILE = 'src/auth/login.ts';

let repoDir: string | null = null;
let outputDir: string | null = null;
let serve: ServeProcess | null = null;

test.afterEach(() => {
  serve?.kill();
  serve = null;
  for (const dir of [repoDir, outputDir]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
  repoDir = null;
  outputDir = null;
});

test('a review completed in the browser is written to the output file', async ({
  page,
}) => {
  repoDir = createTestRepo();
  outputDir = mkdtempSync(join(tmpdir(), 'self-review-serve-out-'));
  const outputPath = join(outputDir, 'review.xml');

  serve = await startServe(['--output', outputPath], repoDir);

  await page.goto(serve.url);
  await expect(page.locator('[data-testid^="file-entry-"]')).toHaveCount(
    FIXTURE_FILE_COUNT,
    { timeout: 15_000 }
  );

  await triggerCommentIcon(page, COMMENTED_FILE, 5, 'new');
  await page.locator('[data-testid="comment-input"] textarea').fill('Fix this');
  await page.locator('[data-testid="add-comment-btn"]').click();
  await expect(page.locator('[data-testid="comment-input"]')).toHaveCount(0);

  // Nothing is saved until the review is completed — no autosave, no draft.
  expect(existsSync(outputPath)).toBe(false);

  await page.locator('[data-testid="finish-review-btn"]').click();

  // ── The artifact, after the process that writes it has gone ──

  const exitCode = await serve.waitForExit(20_000);
  expect(exitCode).toBe(0);
  expect(serve.stdout()).toBe('');

  expect(existsSync(outputPath)).toBe(true);
  const document = readReviewDocument(outputPath);

  expect(document.review['@_timestamp']).toBeTruthy();
  expect(document.review['@_repository']).toBe(repoDir);
  expect(filesOf(document).map(file => file['@_path']).sort()).toEqual(
    [
      'README.md',
      'docs/architecture.md',
      'src/auth/login.ts',
      'src/config.ts',
      'src/legacy.ts',
      'src/new-feature.ts',
    ]
  );

  const comments = commentsFor(document, COMMENTED_FILE);
  expect(comments).toHaveLength(1);
  expect(comments[0].body).toBe('Fix this');
  expect(String(comments[0]['@_new-line-start'])).toBe('5');
  expect(String(comments[0]['@_new-line-end'])).toBe('5');
  expect(comments[0]['@_old-line-start']).toBeUndefined();
  expect(comments[0]['@_old-line-end']).toBeUndefined();

  // The document the desktop application is held to is the document this one
  // has to be, so it is validated against the same schema.
  const validation = await validateAgainstV3Xsd(outputPath);
  expect(validation.errors).toEqual([]);
  expect(validation.valid).toBe(true);
});
