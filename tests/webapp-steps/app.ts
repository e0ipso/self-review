/**
 * Webapp launcher for E2E tests.
 * Launches a Vite dev server and opens a Playwright browser page against it.
 * This replaces the Electron-based app.ts for testing the @self-review/react library.
 */
import { chromium, Browser, BrowserContext, Page } from '@playwright/test';
import { ChildProcess, spawn, execSync } from 'child_process';
import * as path from 'path';
import * as http from 'http';

const VITE_PORT = 5199;
const VITE_URL = `http://localhost:${VITE_PORT}`;
const VITE_CONFIG = path.resolve(__dirname, '../webapp/vite.config.ts');

let viteProcess: ChildProcess | null = null;
let browser: Browser | null = null;
let context: BrowserContext | null = null;
let appPage: Page | null = null;

/**
 * Check if a port is already in use.
 */
function isPortInUse(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const req = http.get(`http://localhost:${port}`, () => {
      resolve(true);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => {
      req.destroy();
      resolve(false);
    });
  });
}

/**
 * Kill any process occupying the Vite port.
 */
function killPortProcess(port: number): void {
  try {
    execSync(`fuser -k ${port}/tcp 2>/dev/null`, { stdio: 'ignore' });
  } catch {
    // No process on port — fine
  }
}

/**
 * Start the Vite dev server if not already running.
 */
async function startViteServer(): Promise<void> {
  if (viteProcess) return;

  // Check if Vite is already running (orphan from a previous run)
  const alreadyRunning = await isPortInUse(VITE_PORT);
  if (alreadyRunning) {
    // Verify it's serving our app
    return;
  }

  // Kill any orphaned process on our port
  killPortProcess(VITE_PORT);

  viteProcess = spawn('npx', ['vite', '--config', VITE_CONFIG], {
    cwd: path.resolve(__dirname, '../..'),
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  });

  let stderrOutput = '';

  // Wait for the server to be ready
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error(`Vite dev server did not start within 60s. stderr: ${stderrOutput}`));
    }, 60000);

    const onData = (data: Buffer) => {
      const text = data.toString();
      stderrOutput += text;
      if (text.includes('Local:') || text.includes(`localhost:${VITE_PORT}`)) {
        clearTimeout(timeout);
        resolve();
      }
    };

    viteProcess!.stdout?.on('data', onData);
    viteProcess!.stderr?.on('data', onData);

    viteProcess!.on('error', err => {
      clearTimeout(timeout);
      reject(err);
    });

    viteProcess!.on('close', code => {
      clearTimeout(timeout);
      viteProcess = null;
      if (code !== null && code !== 0) {
        reject(new Error(`Vite exited with code ${code}. stderr: ${stderrOutput}`));
      }
    });
  });
}

/**
 * Stop the Vite dev server.
 */
function stopViteServer(): void {
  if (viteProcess) {
    viteProcess.kill();
    viteProcess = null;
  }
  // Also kill any orphan
  killPortProcess(VITE_PORT);
}

/**
 * Launch the webapp in a browser. Starts Vite if needed.
 * @param queryParams Optional URL query parameters (e.g., { categories: 'commenting' })
 */
export async function launchWebapp(
  queryParams: Record<string, string> = {}
): Promise<Page> {
  await startViteServer();

  browser = await chromium.launch({
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--disable-gpu',
    ],
  });
  context = await browser.newContext({
    viewport: { width: 1280, height: 800 },
  });
  appPage = await context.newPage();

  const params = new URLSearchParams(queryParams);
  const url = params.toString() ? `${VITE_URL}?${params}` : VITE_URL;

  await appPage.goto(url);
  await appPage.waitForLoadState('domcontentloaded');

  // Wait for the ReviewPanel to render
  if (queryParams.fixture === 'empty') {
    await appPage
      .locator('[data-testid="empty-diff-help"]')
      .waitFor({ state: 'visible', timeout: 15000 });
  } else {
    await appPage
      .locator('[data-testid^="file-entry-"]')
      .first()
      .waitFor({ state: 'visible', timeout: 15000 });
  }

  return appPage;
}

/**
 * Cleanup: close browser but keep Vite running for speed.
 */
export async function cleanup(): Promise<void> {
  if (context) {
    await context.close().catch(() => {});
    context = null;
  }
  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  appPage = null;
}

/**
 * Stop everything including the Vite server.
 */
export async function cleanupAll(): Promise<void> {
  await cleanup();
  stopViteServer();
}

export function getPage(): Page {
  if (!appPage) throw new Error('Webapp not launched or no page available');
  return appPage;
}

/**
 * Trigger the icon-based comment on a specific line.
 * Same logic as the Electron version — pure Playwright interaction.
 */
export async function triggerCommentIcon(
  filePath: string,
  line: number,
  side: 'old' | 'new'
): Promise<void> {
  const page = getPage();
  const section = page.locator(`[data-testid="file-section-${filePath}"]`);
  const gutter = section.locator(
    `[data-testid="${side}-line-${filePath}-${line}"]`
  );
  await gutter.hover();
  const icon = section.locator(`[data-testid="comment-icon-${side}-${line}"]`);
  await icon.waitFor({ state: 'visible', timeout: 5000 });
  await icon.dispatchEvent('mousedown');
  await page.waitForTimeout(150);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  );
  await page
    .locator('[data-testid="comment-input"]')
    .waitFor({ state: 'visible', timeout: 5000 });
}
