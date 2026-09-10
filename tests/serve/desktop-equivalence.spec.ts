/**
 * The same repository state, reviewed the same way, through both front ends.
 *
 * Serve mode and the desktop application share `@self-review/core` and
 * `@self-review/react` and differ only in transport, so the document they
 * write for one repository state has to be the same document. This compares
 * them element for element and normalises exactly one attribute — the
 * timestamp, which records when each review was completed. Anything else that
 * differs is a finding about the program, not something for this file to
 * paper over.
 *
 * The desktop half needs the packaged renderer (`npm run package`) and a
 * display; without the bundle the case skips rather than pretending, unless
 * SELF_REVIEW_REQUIRE_DESKTOP is set — which CI does, because there the
 * bundle is built by the workflow and its absence is a broken pipeline. The
 * serve half above it runs unconditionally.
 */
import { test, expect } from '@playwright/test';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createTestRepo } from '../fixtures/test-repo';
import { triggerCommentIcon } from '../fixtures/comment-actions';
import { startServe, ServeProcess } from './serve-process';
import { readReviewDocument, XmlNode } from './review-document';
// Importing this module starts a virtual display when there is none, which is
// what the Electron half below needs and the serve half above does not.
import { cleanup as cleanupDesktop, getExitCode, launchApp, saveAndCloseApp } from '../steps/app';

const COMMENTED_FILE = 'src/auth/login.ts';
const COMMENT_BODY = 'Fix this';

/** Where `electron-forge package` and `electron-forge start` put the bundle. */
function desktopBundle(): string | null {
  const root = resolve(__dirname, '../../.webpack');
  for (const candidate of [
    join(root, process.arch, 'main', 'index.js'),
    join(root, 'main', 'index.js'),
  ]) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

let repoDir: string | null = null;
let outputDir: string | null = null;
let serve: ServeProcess | null = null;

test.afterEach(async () => {
  serve?.kill();
  serve = null;
  await cleanupDesktop();
  for (const dir of [repoDir, outputDir]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
  repoDir = null;
  outputDir = null;
});

test('serve mode and the desktop application write the same document', async ({ page }) => {
  // A missing bundle means two different things. Locally it means the
  // developer has not packaged, and skipping is a kindness. In CI the
  // workflow packages before calling this, so a missing bundle means the
  // pipeline broke — and a silent skip there would retire the only check
  // that notices the two front ends drifting apart. The environment says
  // which situation this is.
  const bundle = desktopBundle();
  if (process.env.SELF_REVIEW_REQUIRE_DESKTOP === '1') {
    expect(
      bundle,
      'SELF_REVIEW_REQUIRE_DESKTOP is set, so this comparison must run, but no ' +
        'packaged desktop bundle was found. Run `npm run package` before this suite.'
    ).not.toBeNull();
  }
  test.skip(bundle === null, 'No desktop bundle — run `npm run package` to compare against it.');
  // Electron needs a window server even to render offscreen; the serve half
  // of this file does not.
  test.slow();

  repoDir = createTestRepo();
  outputDir = mkdtempSync(join(tmpdir(), 'self-review-equivalence-'));
  const servePath = join(outputDir, 'serve.xml');
  const desktopPath = join(outputDir, 'desktop.xml');

  // Both reviews must see one repository state, so neither output file may
  // land inside the repository, where it would show up as an untracked file
  // in the other's diff. The desktop has no output flag — its path comes from
  // the configuration file, which is why this is written before either runs
  // and is itself part of the reviewed state.
  writeFileSync(join(repoDir, '.self-review.yaml'), `output-file: "${desktopPath}"\n`);

  // ── Serve mode ──

  serve = await startServe(['--output', servePath], repoDir);
  await page.goto(serve.url);
  await page.locator('[data-testid^="file-entry-"]').first().waitFor({
    state: 'visible',
    timeout: 15_000,
  });
  await triggerCommentIcon(page, COMMENTED_FILE, 5, 'new');
  await page.locator('[data-testid="comment-input"] textarea').fill(COMMENT_BODY);
  await page.locator('[data-testid="add-comment-btn"]').click();
  await page.locator('[data-testid="finish-review-btn"]').click();
  expect(await serve.waitForExit(20_000)).toBe(0);

  // ── The desktop application, over the same fixture ──

  const desktopPage = await launchApp([], repoDir);
  await desktopPage.locator('[data-testid^="file-entry-"]').first().waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  await triggerCommentIcon(desktopPage, COMMENTED_FILE, 5, 'new');
  await desktopPage.locator('[data-testid="comment-input"] textarea').fill(COMMENT_BODY);
  await desktopPage.locator('[data-testid="add-comment-btn"]').click();
  await saveAndCloseApp();
  expect(getExitCode()).toBe(0);

  // ── The comparison ──

  expect(existsSync(servePath)).toBe(true);
  expect(existsSync(desktopPath)).toBe(true);

  const served = readReviewDocument(servePath);
  const desktop = readReviewDocument(desktopPath);

  // When each review was completed is the one legitimate difference: two
  // reviews taken minutes apart carry two times.
  expect(served.review['@_timestamp']).toBeTruthy();
  expect(desktop.review['@_timestamp']).toBeTruthy();
  expect(withoutTimestamp(served)).toEqual(withoutTimestamp(desktop));
});

/** The parsed document with only the review timestamp removed. */
function withoutTimestamp(document: XmlNode): XmlNode {
  const copy = JSON.parse(JSON.stringify(document)) as XmlNode;
  delete copy.review['@_timestamp'];
  return copy;
}
