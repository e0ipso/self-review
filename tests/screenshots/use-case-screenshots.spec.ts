/**
 * Playwright screenshot tests for use-case documentation images.
 *
 * Each test creates its own fixture, launches the Electron app, performs UI
 * interactions to set up the desired screenshot scenario, captures screenshots,
 * and cleans up.
 *
 * Usage:
 *   npm run screenshots
 */
import { test } from '@playwright/test';
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import * as path from 'path';
import {
  createPlanReviewFixture,
  createCodeReviewFixture,
  createExplorationFixture,
  createAIReviewFixture,
} from './screenshot-fixtures';

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

const SCREENSHOTS_DIR = path.resolve(__dirname, '../../docs/screenshots');

// ── Helpers ──────────────────────────────────────────────────

/** Launch the Electron app with the given CLI args and working directory. */
async function launchElectron(
  cliArgs: string[],
  cwd: string,
): Promise<{ electronApp: ElectronApplication; page: Page }> {
  const electronApp = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [...CHROMIUM_FLAGS, findMainBundle(), ...cliArgs],
    cwd,
    env: { ...process.env, NODE_ENV: 'test' },
  });

  const page = await electronApp.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page
    .locator('[data-testid^="file-entry-"]')
    .first()
    .waitFor({ state: 'visible', timeout: 15000 });

  return { electronApp, page };
}

/** Close the Electron app by triggering discardAndQuit. */
async function closeElectron(electronApp: ElectronApplication): Promise<void> {
  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => (window as any).electronAPI.discardAndQuit());
  } catch {
    // Process may already have exited
  }
  await new Promise<void>((resolve) => {
    const proc = electronApp.process();
    if (proc.exitCode !== null || proc.killed) {
      resolve();
      return;
    }
    const timer = setTimeout(() => {
      try {
        proc.kill();
      } catch {
        /* already dead */
      }
      resolve();
    }, 5000);
    proc.on('close', () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

/**
 * Trigger the comment icon on a specific line via mousedown/mouseup.
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
  await gutter.hover();
  const icon = section.locator(
    `[data-testid="comment-icon-${side}-${line}"]`,
  );
  await icon.waitFor({ state: 'visible', timeout: 5000 });
  await icon.dispatchEvent('mousedown');
  await page.waitForTimeout(150);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true })),
  );
  await section
    .locator('[data-testid="comment-input"]')
    .first()
    .waitFor({ state: 'visible', timeout: 5000 });
}

/** Type text into the MDEditor textarea inside a comment input. */
async function typeInCommentEditor(
  page: Page,
  commentInput: ReturnType<Page['locator']>,
  text: string,
): Promise<void> {
  const textarea = commentInput.locator('.w-md-editor-text-input');
  await textarea.click();
  await textarea.fill(text);
}

/** Submit the currently open comment by clicking the Add button. */
async function submitComment(
  commentInput: ReturnType<Page['locator']>,
): Promise<void> {
  await commentInput
    .locator('[data-testid="add-comment-btn"]')
    .click();
}

/** Wait for all comment inputs to close. */
async function waitForInputsClosed(page: Page): Promise<void> {
  const inputs = page.locator('[data-testid="comment-input"]');
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && (await inputs.count()) > 0) {
    await page.waitForTimeout(200);
  }
  await page.waitForTimeout(200);
}

// ── Tests ────────────────────────────────────────────────────

test.describe('Use Case Screenshots', () => {
  test('UC1: Plan Review', async () => {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const repoDir = createPlanReviewFixture();
    let electronApp: ElectronApplication | undefined;

    try {
      ({ electronApp } = await launchElectron([], repoDir));
      const page = await electronApp.firstWindow();

      // Capture raw diff view of plan.md
      const planEntry = page.locator('[data-testid="file-entry-plan.md"]');
      await planEntry.click();
      await page.waitForTimeout(500);
      const rawBuffer = await page.screenshot();

      // Switch to rendered markdown view and capture
      const planHeader = page.locator('[data-testid="file-header-plan.md"]');
      const renderedToggle = planHeader.locator('[aria-label="Rendered view"]');
      await renderedToggle.waitFor({ state: 'visible', timeout: 5000 });
      await renderedToggle.click();
      await page.waitForTimeout(800);
      const renderedBuffer = await page.screenshot();

      // Composite: diagonal split — raw on the left, rendered on the right
      const compositeBuffer = await page.evaluate(
        async ({ rawB64, renderedB64 }) => {
          const loadImg = (b64: string): Promise<HTMLImageElement> =>
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve(img);
              img.onerror = reject;
              img.src = `data:image/png;base64,${b64}`;
            });

          const [rawImg, renderedImg] = await Promise.all([
            loadImg(rawB64),
            loadImg(renderedB64),
          ]);

          const w = rawImg.width;
          const h = rawImg.height;
          const canvas = document.createElement('canvas');
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d')!;

          // Draw raw diff on the left half (diagonal clip)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(0, 0);
          ctx.lineTo(w * 0.6, 0);
          ctx.lineTo(w * 0.4, h);
          ctx.lineTo(0, h);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(rawImg, 0, 0);
          ctx.restore();

          // Draw rendered on the right half (diagonal clip)
          ctx.save();
          ctx.beginPath();
          ctx.moveTo(w * 0.6, 0);
          ctx.lineTo(w, 0);
          ctx.lineTo(w, h);
          ctx.lineTo(w * 0.4, h);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(renderedImg, 0, 0);
          ctx.restore();

          // Draw diagonal divider line
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
          ctx.lineWidth = 3;
          ctx.beginPath();
          ctx.moveTo(w * 0.6, 0);
          ctx.lineTo(w * 0.4, h);
          ctx.stroke();

          // Labels
          ctx.font = 'bold 14px system-ui, sans-serif';
          ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
          ctx.fillRect(8, h - 36, 70, 24);
          ctx.fillRect(w - 98, 12, 90, 24);
          ctx.fillStyle = '#fff';
          ctx.fillText('Raw diff', 14, h - 18);
          ctx.fillText('Rendered', w - 92, 30);

          return canvas
            .toDataURL('image/png')
            .replace('data:image/png;base64,', '');
        },
        {
          rawB64: rawBuffer.toString('base64'),
          renderedB64: renderedBuffer.toString('base64'),
        },
      );

      writeFileSync(
        path.join(SCREENSHOTS_DIR, 'uc1-raw-vs-rendered.png'),
        Buffer.from(compositeBuffer, 'base64'),
      );

      // Screenshot 2: inline comment on rendered markdown
      const planSection = page.locator(
        '[data-testid="file-section-plan.md"]',
      );
      const renderedView = planSection.locator('.rendered-markdown-view');
      await renderedView.waitFor({ state: 'visible', timeout: 10000 });
      const pBlock = planSection.locator('p.rendered-block').first();
      await pBlock.waitFor({ state: 'visible', timeout: 5000 });
      await pBlock.hover();
      const renderedGutter = pBlock.locator('.rendered-gutter');
      await renderedGutter.dispatchEvent('mousedown');
      await page.waitForTimeout(100);
      await page.evaluate(() =>
        document.dispatchEvent(
          new MouseEvent('mouseup', { bubbles: true }),
        ),
      );
      await page.waitForTimeout(300);

      const commentInput = planSection
        .locator('[data-testid="comment-input"]')
        .first();
      await commentInput.waitFor({ state: 'visible', timeout: 5000 });
      await typeInCommentEditor(
        page,
        commentInput,
        'This migration strategy should include a rollback plan for each endpoint',
      );
      await submitComment(commentInput);
      await waitForInputsClosed(page);
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'uc1-inline-comment.png'),
      });
    } finally {
      if (electronApp) {
        await closeElectron(electronApp);
      }
      try {
        rmSync(repoDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  });

  test('UC2: Code Review', async () => {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const repoDir = createCodeReviewFixture();
    let electronApp: ElectronApplication | undefined;

    try {
      ({ electronApp } = await launchElectron([], repoDir));
      const page = await electronApp.firstWindow();

      // Navigate to src/auth/login.ts
      const loginEntry = page.locator(
        '[data-testid="file-entry-src/auth/login.ts"]',
      );
      await loginEntry.click();
      await page.waitForTimeout(500);

      // Screenshot 1: add a line comment on line 9
      const loginSection = page.locator(
        '[data-testid="file-section-src/auth/login.ts"]',
      );
      await triggerCommentIcon(page, 'src/auth/login.ts', 9, 'new');
      const commentInput = loginSection
        .locator('[data-testid="comment-input"]')
        .first();
      await typeInCommentEditor(
        page,
        commentInput,
        'Consider logging failed attempts with rate limiting',
      );
      await submitComment(commentInput);
      await waitForInputsClosed(page);
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'uc2-comment.png'),
      });

      // Screenshot 3: add a comment with a suggestion on a different line
      await triggerCommentIcon(page, 'src/auth/login.ts', 11, 'new');
      const suggestInput = loginSection
        .locator('[data-testid="comment-input"]')
        .first();
      await typeInCommentEditor(
        page,
        suggestInput,
        'Use a structured error type instead of returning null',
      );
      // Click the suggestion button to open suggestion block
      const suggestBtn = suggestInput.locator(
        '[data-testid="add-suggestion-btn"]',
      );
      await suggestBtn.waitFor({ state: 'visible', timeout: 5000 });
      await suggestBtn.click();
      await page.waitForTimeout(300);

      // Fill in the proposed code
      const proposedEditor = suggestInput.locator(
        '[data-testid="suggestion-proposed"] textarea',
      );
      await proposedEditor.waitFor({ state: 'visible', timeout: 3000 });
      await proposedEditor.fill(
        '    return { success: false, reason: "invalid_password" };',
      );
      await page.waitForTimeout(200);
      await submitComment(suggestInput);
      await waitForInputsClosed(page);
      await page.waitForTimeout(300);

      // Scroll to show the suggestion block
      const suggestionBlock = loginSection
        .locator('[data-testid="suggestion-block"]')
        .first();
      await suggestionBlock.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'uc2-suggestion.png'),
      });
    } finally {
      if (electronApp) {
        await closeElectron(electronApp);
      }
      try {
        rmSync(repoDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  });

  test('UC3: Codebase Exploration', async () => {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const repoDir = createExplorationFixture();
    let electronApp: ElectronApplication | undefined;

    try {
      ({ electronApp } = await launchElectron([], repoDir));
      const page = await electronApp.firstWindow();

      // Add comments with different categories on different files
      // Comment 1: question on src/auth/middleware.ts
      await triggerCommentIcon(page, 'src/auth/middleware.ts', 10, 'new');
      const section1 = page.locator(
        '[data-testid="file-section-src/auth/middleware.ts"]',
      );
      const input1 = section1
        .locator('[data-testid="comment-input"]')
        .first();
      const catSelector1 = input1.locator(
        '[data-testid="category-selector"]',
      );
      await catSelector1.click();
      await page.waitForTimeout(200);
      await page
        .locator('[data-testid="category-option-question"]')
        .first()
        .click();
      await page.waitForTimeout(200);
      await typeInCommentEditor(
        page,
        input1,
        'What happens when the rate limit map grows unbounded?',
      );
      await submitComment(input1);
      await waitForInputsClosed(page);

      // Comment 2: improvement on src/utils/helpers.ts
      const helpersEntry = page.locator(
        '[data-testid="file-entry-src/utils/helpers.ts"]',
      );
      await helpersEntry.click();
      await page.waitForTimeout(500);
      await triggerCommentIcon(page, 'src/utils/helpers.ts', 7, 'new');
      const section2 = page.locator(
        '[data-testid="file-section-src/utils/helpers.ts"]',
      );
      const input2 = section2
        .locator('[data-testid="comment-input"]')
        .first();
      const catSelector2 = input2.locator(
        '[data-testid="category-selector"]',
      );
      await catSelector2.click();
      await page.waitForTimeout(200);
      await page
        .locator('[data-testid="category-option-improvement"]')
        .first()
        .click();
      await page.waitForTimeout(200);
      await typeInCommentEditor(
        page,
        input2,
        'Consider making the expiry time configurable',
      );
      await submitComment(input2);
      await waitForInputsClosed(page);

      // Comment 3: needs-docs on docs/api-guide.md
      const docsEntry = page.locator(
        '[data-testid="file-entry-docs/api-guide.md"]',
      );
      await docsEntry.click();
      await page.waitForTimeout(500);
      await triggerCommentIcon(page, 'docs/api-guide.md', 13, 'new');
      const section3 = page.locator(
        '[data-testid="file-section-docs/api-guide.md"]',
      );
      const input3 = section3
        .locator('[data-testid="comment-input"]')
        .first();
      const catSelector3 = input3.locator(
        '[data-testid="category-selector"]',
      );
      await catSelector3.click();
      await page.waitForTimeout(200);
      await page
        .locator('[data-testid="category-option-needs-docs"]')
        .first()
        .click();
      await page.waitForTimeout(200);
      await typeInCommentEditor(
        page,
        input3,
        'Add rate limit headers to the API documentation',
      );
      await submitComment(input3);
      await waitForInputsClosed(page);
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'uc3-categorized.png'),
      });

    } finally {
      if (electronApp) {
        await closeElectron(electronApp);
      }
      try {
        rmSync(repoDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  });

  test('UC4: AI-Assisted Review', async () => {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    const { repoDir, xmlPath } = createAIReviewFixture();
    let electronApp: ElectronApplication | undefined;

    try {
      // Launch with --resume-from to load pre-existing AI comments
      ({ electronApp } = await launchElectron(
        ['--resume-from', xmlPath],
        repoDir,
      ));
      const page = await electronApp.firstWindow();

      // Navigate to src/auth/login.ts which has the AI comments
      const loginEntry = page.locator(
        '[data-testid="file-entry-src/auth/login.ts"]',
      );
      await loginEntry.click();
      await page.waitForTimeout(800);

      // Add a new user comment alongside the pre-loaded AI ones
      await triggerCommentIcon(page, 'src/auth/login.ts', 6, 'new');
      const loginSection = page.locator(
        '[data-testid="file-section-src/auth/login.ts"]',
      );
      const commentInput = loginSection
        .locator('[data-testid="comment-input"]')
        .first();
      await typeInCommentEditor(
        page,
        commentInput,
        'Good catch by the AI review. I agree this needs bcrypt.',
      );
      await submitComment(commentInput);
      await waitForInputsClosed(page);
      await page.waitForTimeout(300);
      await page.screenshot({
        path: path.join(SCREENSHOTS_DIR, 'uc4-mixed-comments.png'),
      });
    } finally {
      if (electronApp) {
        await closeElectron(electronApp);
      }
      try {
        rmSync(repoDir, { recursive: true, force: true });
      } catch {
        /* best effort */
      }
    }
  });
});
