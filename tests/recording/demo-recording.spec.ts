/**
 * Playwright recording test — single-session demo of self-review.
 *
 * Injects a visible cursor overlay so mouse movements appear in the video.
 *
 * Script:
 *   1. Show the diff by scrolling down
 *   2. Click a file in the file tree to scroll
 *   3. Add a line comment
 *   4. Add a file-level comment with a different category
 *   5. Toggle new files on/off
 *   6. Switch to Unified view
 *   7. Switch to dark theme
 *   8. Edit the first comment to add a suggestion
 *   9. Switch back to light theme
 *  10. Close the window (triggers confirmation dialog)
 *  11. Click "Save & Quit"
 *
 * Usage:
 *   npm run record:demo
 */
import { test } from '@playwright/test';
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { existsSync, copyFileSync, writeFileSync, rmSync } from 'fs';
import { mkdtempSync } from 'fs';
import * as path from 'path';
import { tmpdir } from 'os';
import { createTestRepo } from '../fixtures/test-repo';

const ELECTRON_BIN: string = require('electron') as unknown as string;

function findMainBundle(): string {
  const root = path.resolve(__dirname, '../../.webpack');
  const archPath = path.join(root, process.arch, 'main', 'index.js');
  if (existsSync(archPath)) return archPath;
  const devPath = path.join(root, 'main', 'index.js');
  if (existsSync(devPath)) return devPath;
  throw new Error(`Cannot find webpack main bundle in ${root}`);
}

const CHROMIUM_FLAGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-namespace-sandbox',
];

// ── Cursor overlay ──────────────────────────────────────────
/** Inject a visible cursor dot that follows mouse movements. */
async function injectCursor(page: Page): Promise<void> {
  await page.evaluate(() => {
    const cursor = document.createElement('div');
    cursor.id = '__pw-cursor';
    Object.assign(cursor.style, {
      position: 'fixed',
      zIndex: '2147483647',
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      background: 'rgba(255, 80, 80, 0.7)',
      border: '2px solid rgba(255, 255, 255, 0.9)',
      boxShadow: '0 0 6px rgba(0,0,0,0.35)',
      pointerEvents: 'none',
      transform: 'translate(-50%, -50%)',
      transition: 'left 0.08s ease-out, top 0.08s ease-out, scale 0.1s',
      left: '-100px',
      top: '-100px',
    });
    document.body.appendChild(cursor);

    document.addEventListener('mousemove', (e) => {
      cursor.style.left = e.clientX + 'px';
      cursor.style.top = e.clientY + 'px';
    }, true);

    document.addEventListener('mousedown', () => {
      cursor.style.scale = '0.7';
    }, true);
    document.addEventListener('mouseup', () => {
      cursor.style.scale = '1';
    }, true);
  });
}

// ── Helpers ──────────────────────────────────────────────────

/** Human-paced delay. */
async function pause(page: Page, ms = 800): Promise<void> {
  await page.waitForTimeout(ms);
}

/** Move mouse visibly to the center of an element, then click. */
async function humanClick(page: Page, locator: ReturnType<Page['locator']>): Promise<void> {
  const box = await locator.boundingBox();
  if (box) {
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2, { steps: 12 });
    await pause(page, 200);
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  } else {
    await locator.click();
  }
}

/** Type text character-by-character with the cursor visible on the target. */
async function humanType(
  page: Page,
  locator: ReturnType<Page['locator']>,
  text: string,
): Promise<void> {
  await humanClick(page, locator);
  await pause(page, 200);
  await locator.pressSequentially(text, { delay: 45 });
}

/**
 * Trigger the comment icon on a specific line.
 * Moves the cursor visibly to the gutter before clicking.
 */
async function triggerCommentIcon(
  page: Page,
  filePath: string,
  line: number,
  side: 'old' | 'new',
): Promise<void> {
  const section = page.locator(`[data-testid="file-section-${filePath}"]`);
  const gutter = section.locator(
    `[data-testid="${side}-line-${filePath}-${line}"]`,
  );
  // Move cursor visibly to the gutter
  const gBox = await gutter.boundingBox();
  if (gBox) {
    await page.mouse.move(gBox.x + gBox.width / 2, gBox.y + gBox.height / 2, { steps: 15 });
  }
  await pause(page, 400);
  const icon = section.locator(`[data-testid="comment-icon-${side}-${line}"]`);
  await icon.dispatchEvent('mousedown');
  await page.waitForTimeout(100);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })),
  );
  await section
    .locator('[data-testid="comment-input"]')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });
}

/** Wait until no comment inputs are open. */
async function waitForInputsClosed(page: Page): Promise<void> {
  const inputs = page.locator('[data-testid="comment-input"]');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && (await inputs.count()) > 0) {
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(200);
}

// ── Test ─────────────────────────────────────────────────────

test('Record demo', async () => {
  // ── Setup ──
  const repoDir = createTestRepo();
  writeFileSync(
    path.join(repoDir, '.self-review.yaml'),
    [
      'categories:',
      '  - name: "bug"',
      '    description: "bug category"',
      '    color: "#e53e3e"',
      '  - name: "nit"',
      '    description: "nit category"',
      '    color: "#718096"',
      '  - name: "question"',
      '    description: "question category"',
      '    color: "#805ad5"',
    ].join('\n') + '\n',
  );

  const videoDir = mkdtempSync(path.join(tmpdir(), 'self-review-recording-'));

  const electronApp: ElectronApplication = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [...CHROMIUM_FLAGS, findMainBundle()],
    cwd: repoDir,
    env: { ...process.env, NODE_ENV: 'test' },
    recordVideo: {
      dir: videoDir,
      size: { width: 1280, height: 800 },
    },
  });

  const page: Page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.locator('[data-testid^="file-entry-"]').first().waitFor({ state: 'visible', timeout: 10000 });

  // Inject visible cursor
  await injectCursor(page);

  const loginSection = page.locator('[data-testid="file-section-src/auth/login.ts"]');
  const getInput = () => loginSection.locator('[data-testid="comment-input"]').first();

  try {
    // ── 1. Show the diff by scrolling a bit down ──
    await pause(page, 1500);
    const configSection = page.locator('[data-testid="file-section-src/config.ts"]');
    await configSection.scrollIntoViewIfNeeded();
    await pause(page, 1500);

    // ── 2. Click a file in the file tree to scroll ──
    const loginEntry = page.locator('[data-testid="file-entry-src/auth/login.ts"]');
    await humanClick(page, loginEntry);
    await pause(page, 1500);

    // ── 3. Add a line comment ──
    await waitForInputsClosed(page);
    await triggerCommentIcon(page, 'src/auth/login.ts', 9, 'new');
    await pause(page, 400);
    await humanType(page, getInput().locator('textarea'), 'This variable name is misleading');
    await pause(page, 500);
    await humanClick(page, getInput().locator('[data-testid="add-comment-btn"]'));
    await pause(page, 1500);

    // ── 4. Add a file-level comment with a different category ──
    await waitForInputsClosed(page);
    const fileCommentBtn = page.locator('[data-testid="add-file-comment-src/auth/login.ts"]');
    await fileCommentBtn.scrollIntoViewIfNeeded();
    await pause(page, 300);
    await humanClick(page, fileCommentBtn);
    await pause(page, 500);

    // Select "question" category
    const catSelector = getInput().locator('[data-testid="category-selector"]');
    await humanClick(page, catSelector);
    await pause(page, 400);
    await humanClick(page, page.locator('[data-testid="category-option-question"]').first());
    await pause(page, 400);

    await humanType(page, getInput().locator('textarea'), 'Should this file be split into smaller modules?');
    await pause(page, 500);
    await humanClick(page, getInput().locator('[data-testid="add-comment-btn"]'));
    await pause(page, 1500);

    // ── 5. Toggle new files on/off ──
    const toggleNewFiles = page.locator('[data-testid="toggle-untracked-btn"]');
    await humanClick(page, toggleNewFiles);
    await pause(page, 1200);
    await humanClick(page, toggleNewFiles);
    await pause(page, 1200);

    // ── 6. Switch to Unified view ──
    const unifiedBtn = page.locator('[data-testid="view-mode-unified"]');
    await humanClick(page, unifiedBtn);
    await pause(page, 1500);

    // ── 7. Switch to dark theme ──
    const darkBtn = page.locator('[data-testid="theme-option-dark"]');
    await humanClick(page, darkBtn);
    await pause(page, 2000);

    // ── 8. Edit the first (line-level) comment to add a suggestion ──
    // Note: the suggest button only appears for line-level comments (not file-level),
    // because originalCode is derived from the line range in the diff.
    await waitForInputsClosed(page);
    const commentSelector = '[data-testid^="comment-"]:not([data-testid^="comment-icon"]):not([data-testid="comment-input"]):not([data-testid^="comment-collapse"])';

    // The first line-level comment is the one on line 9 of login.ts.
    // In unified view, file-level comments render at the top, so the line comment
    // may be second. Find it by looking for the one containing our text.
    const lineComment = loginSection
      .locator(commentSelector, { hasText: 'This variable name is misleading' });
    await lineComment.scrollIntoViewIfNeeded();
    await pause(page, 400);

    // Hover to reveal action buttons (opacity-0 → opacity-100 on group-hover)
    await lineComment.hover();
    await pause(page, 600);

    // Click the Edit button (Pencil icon)
    const editBtn = lineComment.locator('button', { has: page.locator('.lucide-pencil') });
    await editBtn.waitFor({ state: 'visible', timeout: 3000 });
    await humanClick(page, editBtn);
    await pause(page, 500);

    // The comment is now a CommentInput (edit mode replaces the display).
    // There are two comment-inputs on page: the file-level one (no suggest btn)
    // and the line-level one we just opened (has suggest btn). Target by text.
    const editInput = page.locator('[data-testid="comment-input"]', { hasText: 'line 9' });
    await editInput.waitFor({ state: 'visible', timeout: 5000 });

    // Click "Suggest"
    const suggestBtn = editInput.locator('[data-testid="add-suggestion-btn"]');
    await suggestBtn.waitFor({ state: 'visible', timeout: 5000 });
    await humanClick(page, suggestBtn);
    await pause(page, 600);

    // Type proposed code
    const proposedEditor = editInput.locator('[data-testid="suggestion-proposed"] textarea');
    await proposedEditor.waitFor({ state: 'visible', timeout: 3000 });
    await humanType(page, proposedEditor, 'const isValid = await verifyPassword(password, user.hash);');
    await pause(page, 600);

    // Submit
    await humanClick(page, editInput.locator('[data-testid="add-comment-btn"]'));
    await pause(page, 2000);

    // Scroll to show the suggestion block
    const suggestionBlock = loginSection.locator('[data-testid="suggestion-block"]').first();
    await suggestionBlock.scrollIntoViewIfNeeded();
    await pause(page, 1500);

    // ── 9. Switch back to light theme ──
    const lightBtn = page.locator('[data-testid="theme-option-light"]');
    await humanClick(page, lightBtn);
    await pause(page, 1500);

    // ── 10. Close the window (triggers confirmation dialog) ──
    // Trigger close via main process — this sends app:close-requested to renderer
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.close();
    });
    await pause(page, 1500);

    // ── 11. Click "Save & Quit" ──
    const saveBtn = page.locator('button:has-text("Save & Quit")');
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await humanClick(page, saveBtn);

    // Wait for process exit
    await new Promise<void>(resolve => {
      const proc = electronApp.process();
      proc.on('close', () => resolve());
      setTimeout(() => {
        try { proc.kill(); } catch { /* already dead */ }
        resolve();
      }, 10000);
    });
  } catch (err) {
    // On failure, still close the app
    try {
      await page.evaluate(() => (window as any).electronAPI.discardAndQuit());
    } catch { /* ignore */ }
    await new Promise<void>(resolve => {
      const proc = electronApp.process();
      proc.on('close', () => resolve());
      setTimeout(() => {
        try { proc.kill(); } catch { /* dead */ }
        resolve();
      }, 5000);
    });
    throw err;
  } finally {
    // Copy video to docs/
    const videoPath = await page.video()?.path();
    if (videoPath) {
      const destPath = path.resolve(__dirname, '../../docs/demo-recording.webm');
      await new Promise(r => setTimeout(r, 2000));
      try {
        copyFileSync(videoPath, destPath);
        console.error(`\nVideo saved to: ${destPath}\n`);
      } catch (copyErr) {
        console.error(`\nVideo at: ${videoPath}`);
        console.error(`Copy failed: ${copyErr}\n`);
      }
    }

    // Cleanup temp dirs
    try {
      rmSync(repoDir, { recursive: true, force: true });
      rmSync(videoDir, { recursive: true, force: true });
    } catch { /* best effort */ }
  }
});
