/**
 * Step definitions for Feature 15: Quit and save recovery.
 *
 * Native dialogs cannot be driven from the page, so the scenarios stub
 * `dialog.showMessageBox` and `dialog.showSaveDialog` inside the main
 * process through `electronApp.evaluate` and read back what was shown. Menu
 * Quit is exercised by clicking the real `quit` role item of the application
 * menu, which is what Ctrl+Q / Cmd+Q dispatch to.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'fs';
import { dirname, join } from 'path';
import { XMLParser } from 'fast-xml-parser';
import {
  getElectronApp,
  getExitCode,
  getOutputFilePath,
  getPage,
  getTestRepoDir,
  outputFileExists,
  waitForAppExit,
} from './app';

const { Given, When, Then } = createBdd();

interface RecordedMessageBox {
  type?: string;
  title?: string;
  message: string;
  detail?: string;
}

const CLOSE_DIALOG_BUTTONS: Record<string, string> = {
  Cancel: 'close-confirm-cancel',
  Discard: 'close-confirm-discard',
  'Save & Quit': 'close-confirm-save',
};

/** Install the message-box recorder in the main process (idempotent). */
async function captureMessageBoxes(): Promise<void> {
  await getElectronApp().evaluate(({ dialog }) => {
    const g = globalThis as { __srMessageBoxes?: unknown[] };
    if (g.__srMessageBoxes) return;
    g.__srMessageBoxes = [];
    dialog.showMessageBox = (async (...args: unknown[]) => {
      // Called as showMessageBox(window, options) or showMessageBox(options).
      const options = args.find(a => a !== null && typeof a === 'object' && 'message' in a);
      g.__srMessageBoxes!.push(options);
      return { response: 0, checkboxChecked: false };
    }) as typeof dialog.showMessageBox;
  });
}

async function recordedMessageBoxes(): Promise<RecordedMessageBox[]> {
  return getElectronApp().evaluate(() => {
    const g = globalThis as { __srMessageBoxes?: RecordedMessageBox[] };
    return g.__srMessageBoxes ?? [];
  });
}

// ── Given ──

// Must follow the launch step: the stub lives in the launched main process.
Given('native message boxes are captured instead of shown', async () => {
  await captureMessageBoxes();
});

// ── When ──

When('I press the Finish Review button', async () => {
  const page = getPage();
  await page.locator('[data-testid="finish-review-btn"]').click();
});

When('I quit through the application menu', async () => {
  await getElectronApp().evaluate(({ Menu }) => {
    type Item = Electron.MenuItem;
    const find = (items: Item[]): Item | null => {
      for (const item of items) {
        if (item.role === 'quit') return item;
        if (item.submenu) {
          const found = find(item.submenu.items);
          if (found) return found;
        }
      }
      return null;
    };
    const menu = Menu.getApplicationMenu();
    const quit = menu ? find(menu.items) : null;
    if (!quit) throw new Error('The application menu has no Quit item');
    quit.click();
  });
});

When('I choose {string} in the close confirmation dialog', async ({}, choice: string) => {
  const testId = CLOSE_DIALOG_BUTTONS[choice];
  if (!testId) throw new Error(`Unknown close dialog choice: ${choice}`);
  const page = getPage();
  const button = page.locator(`[data-testid="${testId}"]`);
  if (choice === 'Cancel') {
    await button.click();
    return;
  }
  // Discard and a successful Save & Quit end the process at once, so the
  // page can close before the click settles; that is the expected outcome,
  // and the scenario's next step asserts the exit itself.
  await button.waitFor({ state: 'visible' });
  try {
    await button.click({ timeout: 5000 });
  } catch {
    // Target closed: the app exited on the click.
  }
});

When(
  'the output path is replaced by a directory containing {string}',
  async ({}, marker: string) => {
    const outputPath = getOutputFilePath();
    rmSync(outputPath, { recursive: true, force: true });
    mkdirSync(outputPath);
    writeFileSync(join(outputPath, marker), 'do not touch\n');
  }
);

When('I change the output path to {string}', async ({}, relativePath: string) => {
  const target = join(getTestRepoDir(), relativePath);
  mkdirSync(dirname(target), { recursive: true });
  await getElectronApp().evaluate(({ dialog }, filePath) => {
    dialog.showSaveDialog = (async () => ({
      canceled: false,
      filePath,
    })) as typeof dialog.showSaveDialog;
  }, target);
  const info = await getPage().evaluate(() => (window as any).electronAPI.changeOutputPath());
  expect(info?.resolvedOutputPath).toBe(target);
  expect(info?.outputPathWritable).toBe(true);
});

// ── Then ──

Then('the close confirmation dialog should be visible', async () => {
  await expect(getPage().locator('[data-testid="close-confirm-dialog"]')).toBeVisible();
});

Then('the close confirmation dialog should be closed', async () => {
  await expect(getPage().locator('[data-testid="close-confirm-dialog"]')).toBeHidden();
});

Then('the app should still be running', async () => {
  // Give a wrongly-exiting process a moment to do so before asserting.
  await getPage().waitForTimeout(1000);
  expect(getExitCode()).toBeNull();
  expect(getElectronApp().process().exitCode).toBeNull();
  // The window is still live and answers.
  expect(await getPage().evaluate(() => document.readyState)).toBe('complete');
});

Then('a save error dialog should report {string}', async ({}, code: string) => {
  await expect
    .poll(async () => (await recordedMessageBoxes()).length, { timeout: 10000 })
    .toBeGreaterThan(0);
  const boxes = await recordedMessageBoxes();
  const last = boxes[boxes.length - 1];
  expect(last.type).toBe('error');
  expect(last.detail ?? '').toContain(`Code: ${code}`);
  expect(last.message.length).toBeGreaterThan(0);
});

Then(
  'the output path should still be a directory containing {string}',
  async ({}, marker: string) => {
    const outputPath = getOutputFilePath();
    expect(statSync(outputPath).isDirectory()).toBe(true);
    expect(readFileSync(join(outputPath, marker), 'utf-8')).toBe('do not touch\n');
  }
);

Then('the app should exit with code {int}', async ({}, code: number) => {
  const exitCode = await waitForAppExit(15000);
  expect(exitCode).toBe(code);
});

Then('the output file should not exist', async () => {
  expect(outputFileExists()).toBe(false);
});

Then(
  'the review file {string} should contain a comment with body {string}',
  async ({}, relativePath: string, body: string) => {
    const target = join(getTestRepoDir(), relativePath);
    expect(existsSync(target)).toBe(true);
    const parsed = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' }).parse(
      readFileSync(target, 'utf-8')
    );
    const files = Array.isArray(parsed.review.file) ? parsed.review.file : [parsed.review.file];
    const bodies = files.flatMap((f: any) => {
      if (!f?.comment) return [];
      const comments = Array.isArray(f.comment) ? f.comment : [f.comment];
      return comments.map((c: any) => String(c.body));
    });
    expect(bodies).toContain(body);
  }
);
