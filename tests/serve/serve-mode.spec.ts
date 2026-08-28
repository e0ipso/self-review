/**
 * The served review loop, end to end.
 *
 * Every other test of serve mode stops at a seam: the route tests call the
 * handlers with a fabricated session, the adapter tests stub `fetch`, and the
 * webapp suite drives the same React package against an in-browser fixture. All
 * of them can pass while the loop is broken, because none of them starts the
 * real command, and none of them reads the file the reviewer actually gets.
 *
 * So this test asserts the artifact, not the transport. A 200 from
 * `POST /api/review` proves a request succeeded; the XML on disk is the thing
 * the reviewer keeps, and the process having exited is the thing that stops a
 * finished session from leaving a listener behind.
 */
import { test, expect, type Page } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import {
  createServeRepo,
  removeServeRepo,
  startServeSession,
  FIXTURE_CHANGED_LINE,
  FIXTURE_FILE,
  FIXTURE_NEW_TEXT,
  FIXTURE_OLD_TEXT,
  type ServeSession,
} from './serve-session';

/** The comment body, chosen to be unmistakable in the XML. */
const COMMENT_BODY = 'Prefer a template literal over concatenation';

let repoDir: string;
let session: ServeSession;

test.beforeEach(async () => {
  repoDir = createServeRepo();
  session = await startServeSession(repoDir);
});

test.afterEach(async () => {
  // Nothing should be left running by a passing test; this exists so a failing
  // one does not leak a listener into the next.
  await session?.dispose();
  if (repoDir) removeServeRepo(repoDir);
});

/**
 * Open the comment composer on one line.
 *
 * The gutter's "+" is a drag handle: the panel opens a range composer on
 * mousedown and commits it on mouseup, so a plain click never opens anything.
 * `tests/webapp-steps/app.ts` drives it the same way, for the same reason.
 */
async function openCommentComposer(page: Page, line: number): Promise<void> {
  const section = page.locator(`[data-testid="file-section-${FIXTURE_FILE}"]`);
  await section
    .locator(`[data-testid="new-line-${FIXTURE_FILE}-${line}"]`)
    .hover();

  const icon = section.locator(`[data-testid="comment-icon-new-${line}"]`);
  await expect(icon).toBeVisible();
  await icon.dispatchEvent('mousedown');
  await page.waitForTimeout(150);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  );

  await expect(page.locator('[data-testid="comment-input"]')).toBeVisible();
}

test('a comment made in the browser is written to the review file and ends the session', async ({
  page,
}) => {
  // ── Render ──
  await page.goto(session.url);

  const fileEntry = page.locator(`[data-testid="file-entry-${FIXTURE_FILE}"]`);
  await expect(fileEntry).toBeVisible();

  // The diff itself, not just the tree: both sides of the one changed line.
  const section = page.locator(`[data-testid="file-section-${FIXTURE_FILE}"]`);
  await expect(section).toContainText(FIXTURE_NEW_TEXT);
  await expect(section).toContainText(FIXTURE_OLD_TEXT);

  // ── Comment, through the UI ──
  await openCommentComposer(page, FIXTURE_CHANGED_LINE);
  await page
    .locator('[data-testid="comment-input"] textarea')
    .fill(COMMENT_BODY);
  await page.locator('[data-testid="add-comment-btn"]').click();
  await expect(section).toContainText(COMMENT_BODY);

  // The session must still be live at this point, or "it exited" below would
  // be satisfied by a process that had already crashed.
  expect(session.exitCode()).toBeNull();

  // ── Finish, through the UI ──
  await page.getByTestId('finish-review-btn').click();
  await expect(
    page.getByRole('heading', { name: 'Review saved' })
  ).toBeVisible();

  // ── The artifact ──
  const exitCode = await session.waitForExit(30_000);
  expect(exitCode, `serve stderr:\n${session.stderr()}`).toBe(0);

  expect(
    existsSync(session.outputPath),
    `no review written to ${session.outputPath}`
  ).toBe(true);
  const xml = readFileSync(session.outputPath, 'utf-8');

  // Scoped to the single <comment> element so the body and the line anchor are
  // asserted about the same comment, rather than both merely appearing in the
  // document somewhere.
  const comment = xml.match(/<comment\b[\s\S]*?<\/comment>/)?.[0];
  expect(comment, `no <comment> element in:\n${xml}`).toBeTruthy();
  expect(comment).toContain(`new-line-start="${FIXTURE_CHANGED_LINE}"`);
  expect(comment).toContain(`new-line-end="${FIXTURE_CHANGED_LINE}"`);
  expect(comment).toContain(`<body>${COMMENT_BODY}</body>`);

  expect(xml).toContain(`path="${FIXTURE_FILE}"`);
});
