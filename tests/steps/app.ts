/**
 * Shared Electron app management for E2E tests.
 * Provides helpers to launch/close the app and capture stdout/stderr.
 */
import {
  _electron as electron,
  ElectronApplication,
  Page,
} from '@playwright/test';
import { ChildProcess, spawn, execSync } from 'child_process';
import * as path from 'path';
import { rmSync, existsSync, readFileSync } from 'fs';

const ELECTRON_BIN: string = require('electron') as unknown as string;

// Production build (electron-forge package) puts output in .webpack/{arch}/main/
// Dev build (electron-forge start) puts output in .webpack/main/
function findMainBundle(): string {
  const root = path.resolve(__dirname, '../../.webpack');
  const archPath = path.join(root, process.arch, 'main', 'index.js');
  if (existsSync(archPath)) return archPath;
  const devPath = path.join(root, 'main', 'index.js');
  if (existsSync(devPath)) return devPath;
  throw new Error(`Cannot find webpack main bundle in ${root}`);
}

const MAIN_BUNDLE = findMainBundle();

// Chromium sandbox requires SUID helper which isn't available in containers
const CHROMIUM_FLAGS = [
  '--no-sandbox',
  '--disable-dev-shm-usage', // Don't use /dev/shm for shared memory
  '--disable-setuid-sandbox',
  '--disable-gpu',
  '--disable-namespace-sandbox', // Bypass namespace restrictions in containers
];

// Ensure a display server is available for Electron (headless CI)
function ensureDisplay(): void {
  if (process.env.DISPLAY) return;
  try {
    execSync('Xvfb :99 -screen 0 1024x768x24 &', { stdio: 'ignore' });
    process.env.DISPLAY = ':99';
  } catch {
    // If Xvfb isn't available, tests will fail with a clear error
  }
}
ensureDisplay();

let electronApp: ElectronApplication | null = null;
let appPage: Page | null = null;
let stdoutData = '';
let stderrData = '';
let processExitCode: number | null = null;
let processExitPromise: Promise<number> | null = null;
let testRepoDir: string | null = null;

/**
 * Launch the Electron app with the given CLI args and working directory.
 * Returns the first window's Page for UI interaction.
 */
export async function launchApp(cliArgs: string[], cwd: string): Promise<Page> {
  resetState();

  electronApp = await electron.launch({
    executablePath: ELECTRON_BIN,
    args: [...CHROMIUM_FLAGS, MAIN_BUNDLE, ...cliArgs],
    cwd,
    env: { ...process.env, NODE_ENV: 'test' },
  });

  const proc = electronApp.process();
  proc.stdout?.on('data', (data: Buffer) => {
    stdoutData += data.toString();
  });
  proc.stderr?.on('data', (data: Buffer) => {
    stderrData += data.toString();
  });

  processExitPromise = new Promise<number>(resolve => {
    proc.on('close', code => {
      processExitCode = code ?? -1;
      resolve(processExitCode);
    });
  });

  try {
    appPage = await electronApp.firstWindow();
    await appPage.waitForLoadState('domcontentloaded');
    return appPage;
  } catch (error) {
    process.stderr.write(`\n[launchApp failed] ${error}\n`);
    process.stderr.write(
      `[stderr from Electron] ${stderrData.slice(0, 1000)}\n`
    );
    // Kill the orphaned Electron process so the fallback to
    // launchAppExpectExit() doesn't compete with a zombie.
    try {
      electronApp.process().kill();
    } catch {
      // Process may already be dead
    }
    electronApp = null;
    appPage = null;
    throw error;
  }
}

/**
 * Launch the app expecting it to exit immediately (--help, --version, errors).
 * Does NOT try to get a window. Waits for process exit and captures output.
 * Times out after `timeoutMs` milliseconds.
 */
export async function launchAppExpectExit(
  cliArgs: string[],
  cwd: string,
  timeoutMs = 15000
): Promise<void> {
  resetState();

  return new Promise<void>((resolve, reject) => {
    const proc = spawn(
      ELECTRON_BIN,
      [...CHROMIUM_FLAGS, MAIN_BUNDLE, ...cliArgs],
      {
        cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, NODE_ENV: 'test' },
      }
    );

    const timer = setTimeout(() => {
      proc.kill();
      resolve(); // Resolve even on timeout — tests can check exitCode
    }, timeoutMs);

    proc.stdout.on('data', (d: Buffer) => {
      stdoutData += d.toString();
    });
    proc.stderr.on('data', (d: Buffer) => {
      stderrData += d.toString();
    });
    proc.on('close', code => {
      clearTimeout(timer);
      processExitCode = code ?? -1;
      resolve();
    });
    proc.on('error', err => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

/**
 * Close the Electron window by triggering saveAndQuit, which writes XML to file and exits.
 * Use this only when the test needs to assert on the output file.
 */
export async function saveAndCloseApp(): Promise<void> {
  if (!electronApp) return;

  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => {
      (window as any).electronAPI.saveAndQuit();
    });
  } catch {
    // Page/browser already closed — force-kill the process instead.
    try {
      electronApp.process().kill();
    } catch {
      // Already dead
    }
  }

  if (processExitPromise) {
    await Promise.race([
      processExitPromise,
      new Promise<number>(resolve => setTimeout(() => resolve(-1), 15000)),
    ]);
  }
}

/**
 * Close the Electron window by triggering discardAndQuit (no file write).
 * Use this when the test does NOT need the output file.
 */
export async function closeAppWindow(): Promise<void> {
  if (!electronApp) return;

  try {
    const page = await electronApp.firstWindow();
    await page.evaluate(() => {
      (window as any).electronAPI.discardAndQuit();
    });
  } catch {
    // Page/browser already closed — force-kill the process instead.
    try {
      electronApp.process().kill();
    } catch {
      // Already dead
    }
  }

  if (processExitPromise) {
    await Promise.race([
      processExitPromise,
      new Promise<number>(resolve => setTimeout(() => resolve(-1), 15000)),
    ]);
  }
}

/**
 * Full cleanup: close app if running and remove test repo.
 */
export async function cleanup(): Promise<void> {
  if (electronApp) {
    try {
      electronApp.process().kill();
    } catch {
      // Process may already be dead
    }
    electronApp = null;
    appPage = null;
  }

  if (testRepoDir) {
    try {
      rmSync(testRepoDir, { recursive: true, force: true });
    } catch {
      // Best effort cleanup
    }
    testRepoDir = null;
  }
}

export function getPage(): Page {
  if (!appPage) throw new Error('App not launched or no page available');
  return appPage;
}

export function getElectronApp(): ElectronApplication {
  if (!electronApp) throw new Error('App not launched');
  return electronApp;
}

export function getStdout(): string {
  return stdoutData;
}
export function getStderr(): string {
  return stderrData;
}
export function getExitCode(): number | null {
  return processExitCode;
}

export function setTestRepoDir(dir: string): void {
  testRepoDir = dir;
}
export function getTestRepoDir(): string {
  if (!testRepoDir) throw new Error('Test repo not created');
  return testRepoDir;
}

/**
 * Trigger the icon-based comment on a specific line.
 * Simulates mousedown on the + icon → wait for React → mouseup.
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
  await icon.dispatchEvent('mousedown');
  await page.waitForTimeout(100);
  await page.evaluate(() =>
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  );
  await page
    .locator('[data-testid="comment-input"]')
    .waitFor({ state: 'visible', timeout: 5000 });
}

/**
 * Get the path to the output XML file for the current test.
 * The app writes to `./review.xml` relative to its working directory (the test repo).
 */
export function getOutputFilePath(): string {
  const repoDir = getTestRepoDir();
  return path.join(repoDir, 'review.xml');
}

/**
 * Read the output XML file content.
 * Returns the file contents as a string, or throws if the file does not exist.
 */
export function readOutputFile(): string {
  const filePath = getOutputFilePath();
  return readFileSync(filePath, 'utf-8');
}

/**
 * Check whether the output XML file exists.
 */
export function outputFileExists(): boolean {
  return existsSync(getOutputFilePath());
}

/**
 * Remove the output XML file if it exists (for cleanup).
 */
export function removeOutputFile(): void {
  const filePath = getOutputFilePath();
  if (existsSync(filePath)) {
    rmSync(filePath, { force: true });
  }
}

function resetState(): void {
  electronApp = null;
  appPage = null;
  stdoutData = '';
  stderrData = '';
  processExitCode = null;
  processExitPromise = null;
}
