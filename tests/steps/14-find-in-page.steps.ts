/**
 * Step definitions for Feature 14: Find in Page.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import { execSync } from 'child_process';
import { getPage, setTestRepoDir } from './app';

const { Given, When, Then, Step } = createBdd();

// ── Given: git repository with a specific file ──

Given(
  'a git repository with a file {string} containing:',
  async ({}, filePath: string, docString: string) => {
    const repoDir = mkdtempSync(join(tmpdir(), 'self-review-test-'));
    const run = (cmd: string) =>
      execSync(cmd, { cwd: repoDir, stdio: 'pipe' }).toString();

    run('git init');
    run('git config user.email "test@test.com"');
    run('git config user.name "Test"');

    // Create an initial commit so git diff works
    writeFileSync(join(repoDir, '.gitkeep'), '');
    run('git add -A');
    run('git commit -m "Initial commit"');

    // Write the file as an unstaged change (new untracked file)
    const fullPath = join(repoDir, filePath);
    mkdirSync(dirname(fullPath), { recursive: true });
    writeFileSync(fullPath, docString);

    setTestRepoDir(repoDir);
  }
);

// ── Keyboard interaction ──

/**
 * Press a key combo like "Ctrl+F", "Shift+Enter", or "Escape".
 * Uses Step() to match both When and Then (And) contexts.
 */
Step('I press {string}', async ({}, combo: string) => {
  const page = getPage();
  const parts = combo.split('+');
  const key = parts.pop()!;
  const modMap: Record<string, string> = {
    Ctrl: 'Control',
    Cmd: 'Meta',
    Shift: 'Shift',
    Alt: 'Alt',
  };
  const mappedMods = parts.map(m => modMap[m.trim()] || m.trim());
  const playwrightCombo = [...mappedMods, key].join('+');
  await page.keyboard.press(playwrightCombo);
});

// ── Find bar assertions ──

Then('the find bar should be visible', async () => {
  const page = getPage();
  const findInput = page.locator('input[placeholder="Find..."]');
  await expect(findInput).toBeVisible({ timeout: 5000 });
});

Then('the find bar should not be visible', async () => {
  const page = getPage();
  const findInput = page.locator('input[placeholder="Find..."]');
  await expect(findInput).not.toBeVisible({ timeout: 5000 });
});

Then('the find input should be focused', async () => {
  const page = getPage();
  const findInput = page.locator('input[placeholder="Find..."]');
  await expect(findInput).toBeFocused();
});

// ── Find bar interactions ──

When('I type {string} in the find bar', async ({}, text: string) => {
  const page = getPage();
  const findInput = page.locator('input[placeholder="Find..."]');
  await findInput.fill(text);
  // Chromium find-in-page is triggered by the onChange handler which calls
  // findInPage IPC. Wait briefly for the search to complete.
  await page.waitForTimeout(500);
});

// ── Match counter assertions ──

Then('the match counter should show {string}', async ({}, expected: string) => {
  const page = getPage();
  // The match counter is a span sibling of the input inside the find bar
  const counter = page.locator('input[placeholder="Find..."]')
    .locator('..')
    .locator('span');
  await expect(counter).toContainText(expected, { timeout: 5000 });
});

Then('the first match should be highlighted', async () => {
  // Chromium's native find-in-page highlights matches automatically.
  // We verify that the active match ordinal is 1 via the match counter.
  const page = getPage();
  const counter = page.locator('input[placeholder="Find..."]')
    .locator('..')
    .locator('span');
  const text = await counter.textContent();
  expect(text).toMatch(/^1 of \d+$/);
});
