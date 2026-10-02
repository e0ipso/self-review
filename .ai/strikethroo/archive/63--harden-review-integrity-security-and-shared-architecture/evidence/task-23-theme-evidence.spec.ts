/**
 * Task 23 evidence: light/dark Prism syntax highlighting in both front ends.
 *
 * Run from the repository root, after `npm run package` and
 * `npm run build --workspace @self-review/serve`:
 *
 *   env -u WAYLAND_DISPLAY XDG_SESSION_TYPE=x11 DISPLAY=:0 \
 *     npx playwright test --config \
 *     .ai/strikethroo/plans/63--harden-review-integrity-security-and-shared-architecture/evidence/task-23-theme-evidence.playwright.config.ts
 *
 * For each host it switches the toolbar theme, asserts the `.self-review`
 * wrapper's `dark` class, asserts the computed colour of the first Prism
 * keyword token against the two vendored themes, asserts no runtime-injected
 * <style> element exists inside the wrapper, and saves a screenshot next to
 * this file: desktop-light.png, desktop-dark.png, serve-light.png, serve-dark.png.
 */
import { test, expect, Page } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createTestRepo } from '../../../../../tests/fixtures/test-repo';
import { startServe, ServeProcess } from '../../../../../tests/serve/serve-process';
import { launchApp, closeAppWindow, cleanup as cleanupDesktop } from '../../../../../tests/steps/app';

const EVIDENCE_DIR = resolve(__dirname);

/** prism.css `.token.keyword { color: #07a }` (packages/react/src/vendor/prism-light-scoped.css). */
const LIGHT_KEYWORD = 'rgb(0, 119, 170)';
/** prism-one-dark `.token.keyword { color: hsl(286, 60%, 67%) }` (prism-dark-scoped.css). */
const DARK_KEYWORD = 'rgb(198, 120, 221)';

async function captureThemes(page: Page, host: 'desktop' | 'serve'): Promise<void> {
  await page.locator('[data-testid^="file-entry-"]').first().waitFor({
    state: 'visible',
    timeout: 30_000,
  });
  const keyword = page.locator('[data-testid="diff-viewer"] .token.keyword').first();
  await keyword.waitFor({ state: 'visible', timeout: 15_000 });

  for (const [theme, color] of [
    ['dark', DARK_KEYWORD],
    ['light', LIGHT_KEYWORD],
  ] as const) {
    await page.locator(`[data-testid="theme-option-${theme}"]`).click();
    const isDark = await page.evaluate(
      () => document.querySelector('.self-review')?.classList.contains('dark') ?? null
    );
    expect(isDark, `${host}: wrapper dark class after choosing ${theme}`).toBe(theme === 'dark');
    await expect(keyword, `${host}: Prism keyword colour in ${theme}`).toHaveCSS('color', color);
    const injected = await page.evaluate(
      () => document.querySelectorAll('.self-review > style, .self-review style').length
    );
    expect(injected, `${host}: runtime-injected <style> elements`).toBe(0);
    await page.screenshot({ path: join(EVIDENCE_DIR, `task-23-${host}-${theme}.png`) });
  }
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

test('desktop: scoped Prism themes switch with the toolbar', async () => {
  test.slow();
  repoDir = createTestRepo();
  const page = await launchApp([], repoDir);
  await page.setViewportSize({ width: 1280, height: 800 });
  await captureThemes(page, 'desktop');
  await closeAppWindow();
});

test('serve: scoped Prism themes switch with the toolbar', async ({ page }) => {
  repoDir = createTestRepo();
  outputDir = mkdtempSync(join(tmpdir(), 'self-review-task23-'));
  serve = await startServe(['--output', join(outputDir, 'review.xml')], repoDir);
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.goto(serve.url);
  await captureThemes(page, 'serve');
});
