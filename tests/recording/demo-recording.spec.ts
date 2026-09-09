/**
 * Playwright recording test — single-session demo of self-review.
 *
 * Injects a visible cursor overlay so mouse movements appear in the video.
 *
 * Script:
 *   1. Show the diff by scrolling down
 *   2. Click a file in the file tree to scroll
 *   3. Add a line comment with image attachment
 *   4. Add a file-level comment with a different category
 *   5. Toggle new files on/off
 *   6. Expand context (click expand button on a context bar)
 *   7. Switch to Unified view
 *   8. View rendered markdown file + add a comment with a suggestion
 *   9. Close the window (triggers confirmation dialog)
 *  10. Click "Save & Quit"
 *
 * Usage:
 *   npm run record:demo
 */
import { test } from '@playwright/test';
import { _electron as electron, ElectronApplication, Page } from '@playwright/test';
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

    document.addEventListener(
      'mousemove',
      e => {
        cursor.style.left = e.clientX + 'px';
        cursor.style.top = e.clientY + 'px';
      },
      true
    );

    document.addEventListener(
      'mousedown',
      () => {
        cursor.style.scale = '0.7';
      },
      true
    );
    document.addEventListener(
      'mouseup',
      () => {
        cursor.style.scale = '1';
      },
      true
    );
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
  text: string
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
  side: 'old' | 'new'
): Promise<void> {
  const section = page.locator(`[data-testid="file-section-${filePath}"]`);
  const gutter = section.locator(`[data-testid="${side}-line-${filePath}-${line}"]`);
  // Move cursor visibly to the gutter
  const gBox = await gutter.boundingBox();
  if (gBox) {
    await page.mouse.move(gBox.x + gBox.width / 2, gBox.y + gBox.height / 2, { steps: 15 });
  }
  await pause(page, 400);
  const icon = section.locator(`[data-testid="comment-icon-${side}-${line}"]`);
  await icon.dispatchEvent('mousedown');
  await page.waitForTimeout(100);
  await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
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
    ].join('\n') + '\n'
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
  await page
    .locator('[data-testid^="file-entry-"]')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 });

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

    // Paste image first — before typing text — so the async re-render triggered by
    // setAttachments cannot interfere with MDEditor's controlled textarea content.
    await page.evaluate(
      () =>
        new Promise<void>(resolve => {
          const canvas = document.createElement('canvas');
          canvas.width = 100;
          canvas.height = 100;
          const ctx = canvas.getContext('2d')!;
          ctx.fillStyle = '#4a90d9';
          ctx.fillRect(0, 0, 100, 100);
          ctx.fillStyle = '#2c5f8a';
          ctx.fillRect(10, 10, 80, 60);
          ctx.fillStyle = '#ffffff';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText('screenshot', 12, 45);
          canvas.toBlob(blob => {
            if (!blob) {
              resolve();
              return;
            }
            const file = new File([blob], 'screenshot.png', { type: 'image/png' });
            const dt = new DataTransfer();
            dt.items.add(file);
            const section = document.querySelector(
              '[data-testid="file-section-src/auth/login.ts"]'
            );
            const input = section?.querySelector(
              '[data-testid="comment-input"]'
            ) as HTMLElement | null;
            input?.dispatchEvent(
              new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })
            );
            resolve();
          }, 'image/png');
        })
    );
    await pause(page, 800); // allow image processing + thumbnail render

    // Type comment text after the image is attached
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

    await humanType(
      page,
      getInput().locator('textarea'),
      'Should this file be split into smaller modules?'
    );
    await pause(page, 500);
    await humanClick(page, getInput().locator('[data-testid="add-comment-btn"]'));
    await pause(page, 1500);

    // ── 5. Toggle new files on/off ──
    const toggleNewFiles = page.locator('[data-testid="toggle-untracked-btn"]');
    await humanClick(page, toggleNewFiles);
    await pause(page, 1200);
    await humanClick(page, toggleNewFiles);
    await pause(page, 1200);

    // ── 6. Expand context ──
    // Scope to login.ts which has a bottom expand bar with actual hidden lines.
    // Use the down-chevron icon button (expand below the hunk).
    const loginExpandBar = loginSection.locator('.expand-context-bar').first();
    await loginExpandBar.scrollIntoViewIfNeeded();
    await pause(page, 600);
    const expandDownBtn = loginExpandBar.locator('button').filter({
      has: page.locator('svg.lucide-chevron-down'),
    });
    await humanClick(page, expandDownBtn);
    await pause(page, 1500);

    // ── 7. Switch to Unified view ──
    const unifiedBtn = page.locator('[data-testid="view-mode-unified"]');
    await humanClick(page, unifiedBtn);
    await pause(page, 1500);

    // ── 8. View rendered markdown file + add a comment with suggestion ──
    const mdFileEntry = page.locator('[data-testid="file-entry-docs/architecture.md"]');
    await humanClick(page, mdFileEntry);
    await pause(page, 800);

    // Click "Rendered" toggle in the sticky file header
    const mdSection = page.locator('[data-testid="file-section-docs/architecture.md"]');
    const mdHeader = page.locator('[data-testid="file-header-docs/architecture.md"]');
    const renderedToggle = mdHeader.locator('[aria-label="Rendered view"]');
    await renderedToggle.waitFor({ state: 'visible', timeout: 5000 });
    const toggleBox = await renderedToggle.boundingBox();
    if (toggleBox) {
      await page.mouse.move(toggleBox.x + toggleBox.width / 2, toggleBox.y + toggleBox.height / 2, {
        steps: 12,
      });
      await pause(page, 200);
    }
    await renderedToggle.click();
    await pause(page, 1500);

    // Wait for rendered view, then open a comment on the first paragraph block
    const renderedView = mdSection.locator('.rendered-markdown-view');
    await renderedView.waitFor({ state: 'visible', timeout: 10000 });
    const pBlock = page.locator('p.rendered-block').first();
    await pBlock.waitFor({ state: 'visible', timeout: 5000 });
    await pBlock.hover();
    const renderedGutter = pBlock.locator('.rendered-gutter');
    await renderedGutter.dispatchEvent('mousedown');
    await page.waitForTimeout(100);
    await page.evaluate(() => document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })));
    await pause(page, 500);

    const mdInput = mdSection.locator('[data-testid="comment-input"]').first();
    await mdInput.waitFor({ state: 'visible', timeout: 5000 });

    // Click "Suggest" to open the suggestion block (original markdown source pre-filled)
    const suggestBtn = mdInput.locator('[data-testid="add-suggestion-btn"]');
    await suggestBtn.waitFor({ state: 'visible', timeout: 5000 });
    await humanClick(page, suggestBtn);
    await pause(page, 600);

    // Type the comment body — target the MDEditor textarea specifically
    await humanType(
      page,
      mdInput.locator('.w-md-editor-text-input'),
      'Consider adding a diagram here'
    );
    await pause(page, 400);

    // Replace the proposed markdown text — fill() clears existing content, then type visibly
    const proposedEditor = mdInput.locator('[data-testid="suggestion-proposed"] textarea');
    await proposedEditor.waitFor({ state: 'visible', timeout: 3000 });
    await proposedEditor.fill('');
    await humanType(
      page,
      proposedEditor,
      'This document describes the high-level architecture. See the diagram below.'
    );
    await pause(page, 600);

    await humanClick(page, mdInput.locator('[data-testid="add-comment-btn"]'));
    await pause(page, 2000);

    // Scroll to show the suggestion block
    const mdSuggestionBlock = mdSection.locator('[data-testid="suggestion-block"]').first();
    await mdSuggestionBlock.scrollIntoViewIfNeeded();
    await pause(page, 1500);

    // ── 9. Close the window (triggers confirmation dialog) ──
    // Trigger close via main process — this sends app:close-requested to renderer
    await electronApp.evaluate(({ BrowserWindow }) => {
      const win = BrowserWindow.getAllWindows()[0];
      if (win) win.close();
    });
    await pause(page, 1500);

    // ── 10. Click "Save & Quit" ──
    const saveBtn = page.locator('button:has-text("Save & Quit")');
    await saveBtn.waitFor({ state: 'visible', timeout: 5000 });
    await humanClick(page, saveBtn);

    // Wait for process exit
    await new Promise<void>(resolve => {
      const proc = electronApp.process();
      proc.on('close', () => resolve());
      setTimeout(() => {
        try {
          proc.kill();
        } catch {
          /* already dead */
        }
        resolve();
      }, 10000);
    });
  } catch (err) {
    // On failure, still close the app
    try {
      await page.evaluate(() => (window as any).electronAPI.discardAndQuit());
    } catch {
      /* ignore */
    }
    await new Promise<void>(resolve => {
      const proc = electronApp.process();
      proc.on('close', () => resolve());
      setTimeout(() => {
        try {
          proc.kill();
        } catch {
          /* dead */
        }
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
    } catch {
      /* best effort */
    }
  }
});
