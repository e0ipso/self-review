/**
 * A submission the server cannot publish, end to end: the built executable,
 * a real browser, and a filesystem that refuses the write between the two.
 *
 * The output directory loses its write bit after the server has started
 * (startup refuses an unwritable path outright, so the failure has to arrive
 * later, as it does in life). The claim under test is the recovery contract:
 * the page reports the server's own refusal, keeps the review, and the
 * process keeps running; once the directory is writable again the same
 * review is finished, written, and the process stops.
 */
import { test, expect } from '@playwright/test';
import { chmodSync, existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestRepo } from '../fixtures/test-repo';
import { triggerCommentIcon } from '../fixtures/comment-actions';
import { startServe, ServeProcess } from './serve-process';
import { commentsFor, readReviewDocument } from './review-document';

const FIXTURE_FILE_COUNT = 6;
const COMMENTED_FILE = 'src/auth/login.ts';

let repoDir: string | null = null;
let outputDir: string | null = null;
let serve: ServeProcess | null = null;

test.afterEach(() => {
  serve?.kill();
  serve = null;
  for (const dir of [repoDir, outputDir]) {
    if (!dir) continue;
    // The directory may still be read-only if the test failed midway.
    try {
      chmodSync(dir, 0o700);
    } catch {
      // Already gone, or never restricted.
    }
    rmSync(dir, { recursive: true, force: true });
  }
  repoDir = null;
  outputDir = null;
});

test('a refused write keeps the review and the server, and a retry writes the file', async ({
  page,
}) => {
  // Permission bits do not bind root, so the refusal cannot be produced there.
  test.skip(process.getuid?.() === 0, 'Running as root: a read-only directory is still writable.');

  repoDir = createTestRepo();
  outputDir = mkdtempSync(join(tmpdir(), 'self-review-serve-retry-'));
  const outputPath = join(outputDir, 'review.xml');

  serve = await startServe(['--output', outputPath], repoDir);

  await page.goto(serve.url);
  await expect(page.locator('[data-testid^="file-entry-"]')).toHaveCount(FIXTURE_FILE_COUNT, {
    timeout: 15_000,
  });

  await triggerCommentIcon(page, COMMENTED_FILE, 5, 'new');
  await page.locator('[data-testid="comment-input"] textarea').fill('Fix this');
  await page.locator('[data-testid="add-comment-btn"]').click();
  await expect(page.locator('[data-testid="comment-input"]')).toHaveCount(0);

  // ── The refusal ──

  chmodSync(outputDir, 0o500);
  await page.locator('[data-testid="finish-review-btn"]').click();

  const notice = page.locator('[data-testid="submit-error"]');
  await expect(notice).toBeVisible({ timeout: 15_000 });
  await expect(notice).toContainText('permission-denied');
  await expect(notice).toContainText('Finish Review again');
  // Not a completion: the review is still on screen, with its comment, and
  // the process that would write it is still there to ask again.
  await expect(page.locator('[data-testid="finish-review-btn"]')).toBeVisible();
  expect(serve.hasExited()).toBe(false);
  expect(existsSync(outputPath)).toBe(false);
  expect(serve.stderr()).toContain('Review not saved (permission-denied)');

  // ── The fix, and the retry ──

  chmodSync(outputDir, 0o700);
  await page.locator('[data-testid="finish-review-btn"]').click();
  await expect(page.getByText('Review saved')).toBeVisible({ timeout: 15_000 });

  expect(await serve.waitForExit(20_000)).toBe(0);
  expect(serve.stdout()).toBe('');
  expect(existsSync(outputPath)).toBe(true);
  const comments = commentsFor(readReviewDocument(outputPath), COMMENTED_FILE);
  expect(comments).toHaveLength(1);
  expect(comments[0].body).toBe('Fix this');
});
