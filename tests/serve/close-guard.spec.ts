/**
 * The tab-close guard.
 *
 * The desktop application intercepts its window close and offers Save & Quit,
 * Discard or Cancel. A browser gives less: `beforeunload` is a yes/no prompt
 * owned by the browser. This asserts the closest available behaviour, that the
 * prompt appears once there is work to lose and not before.
 *
 * Comments live only in the page until they are submitted, so closing the tab
 * without this loses them silently while the server keeps listening.
 */
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestRepo } from '../fixtures/test-repo';
import { triggerCommentIcon } from '../fixtures/comment-actions';
import { startServe, ServeProcess } from './serve-process';

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

test('closing the tab warns once a comment exists, and stays quiet before that', async ({
  page,
}) => {
  repoDir = createTestRepo();
  outputDir = mkdtempSync(join(tmpdir(), 'self-review-serve-guard-'));

  serve = await startServe(['--output', join(outputDir, 'review.xml')], repoDir);

  await page.goto(serve.url);
  await expect(page.locator('[data-testid^="file-entry-"]')).toHaveCount(FIXTURE_FILE_COUNT, {
    timeout: 15_000,
  });

  // Count the prompts the browser raises. Playwright dismisses them itself, so
  // the handler is what is observed, not a rendered dialog.
  let prompts = 0;
  page.on('dialog', dialog => {
    prompts += 1;
    void dialog.dismiss();
  });

  // Nothing entered yet: a reader who opens the page and leaves loses nothing,
  // and should not be interrogated about it.
  await page.evaluate(() => window.dispatchEvent(new Event('beforeunload', { cancelable: true })));
  expect(prompts).toBe(0);

  await triggerCommentIcon(page, COMMENTED_FILE, 5, 'new');
  await page.locator('[data-testid="comment-input"] textarea').fill('Fix this');
  await page.locator('[data-testid="add-comment-btn"]').click();
  await expect(page.locator('[data-testid="comment-input"]')).toHaveCount(0);

  // Now there is work that exists nowhere else.
  const closed = page.close({ runBeforeUnload: true });
  await page.waitForTimeout(500);
  expect(prompts).toBe(1);
  await closed;
});
