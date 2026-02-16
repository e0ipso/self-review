/**
 * Step definitions for Feature 11: Welcome Screen and Directory Mode.
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { mkdtempSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { tmpdir } from 'os';
import {
  launchApp,
  cleanup,
  getPage,
  setTestRepoDir,
  getTestRepoDir,
  readOutputFile,
  outputFileExists,
} from './app';

const { Given, When, Then, After } = createBdd();

/** Track the temporary directory path for toolbar assertions. */
let tempDirPath: string | null = null;

// ── Cleanup after every scenario ──

After(async () => {
  tempDirPath = null;
  await cleanup();
});

// ── Given: create a temporary directory with known files ──

Given(
  'a temporary directory with the following files:',
  async ({}, table: DataTable) => {
    const dir = mkdtempSync(join(tmpdir(), 'self-review-dir-'));
    const rows = table.hashes();
    for (const row of rows) {
      const filePath = join(dir, row.file);
      mkdirSync(dirname(filePath), { recursive: true });
      writeFileSync(filePath, row.content);
    }
    tempDirPath = dir;
    setTestRepoDir(dir);
  }
);

Given(
  'a temporary directory with a binary file {string}',
  async ({}, filename: string) => {
    const dir = mkdtempSync(join(tmpdir(), 'self-review-dir-'));
    const filePath = join(dir, filename);
    mkdirSync(dirname(filePath), { recursive: true });
    // Write a minimal PNG header (binary content)
    const pngHeader = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00,
      0x0d, 0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00,
      0x00, 0x01, 0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, 0xde,
    ]);
    writeFileSync(filePath, pngHeader);
    tempDirPath = dir;
    setTestRepoDir(dir);
  }
);

// ── When: launch with the directory path as a CLI arg ──

When('I launch self-review with the directory path', async () => {
  const dir = getTestRepoDir();
  // Launch from a non-git temp directory, passing the directory path as an arg.
  // The CWD must NOT be a git repo, so use the temp dir itself as cwd.
  await launchApp([dir], dir);
});

// ── Then: welcome screen assertions ──

Then('the welcome screen should be visible', async () => {
  const page = getPage();
  const welcome = page.locator('[data-testid="welcome-screen"]');
  await expect(welcome).toBeVisible({ timeout: 10000 });
});

Then('the welcome screen should not be visible', async () => {
  const page = getPage();
  const welcome = page.locator('[data-testid="welcome-screen"]');
  await expect(welcome).toHaveCount(0);
});

Then(
  'the welcome screen should show the app title {string}',
  async ({}, title: string) => {
    const page = getPage();
    const welcome = page.locator('[data-testid="welcome-screen"]');
    await expect(welcome).toContainText(title);
  }
);

Then('the welcome screen should describe directory mode', async () => {
  const page = getPage();
  const welcome = page.locator('[data-testid="welcome-screen"]');
  await expect(welcome).toContainText('Directory Mode');
});

// ── Then: toolbar shows directory path ──

Then('the toolbar should contain the directory path', async () => {
  const page = getPage();
  const toolbar = page.locator('[data-testid="toolbar"]');
  // The toolbar displays "Directory: <path>" for directory mode
  await expect(toolbar).toContainText('Directory:');
  if (tempDirPath) {
    await expect(toolbar).toContainText(tempDirPath);
  }
});

// ── Then: XML assertions for directory mode ──

Then('the XML should contain a {string} attribute', async ({}, attr: string) => {
  expect(outputFileExists()).toBe(true);
  const xmlContent = readOutputFile();
  expect(xmlContent).toContain(`${attr}="`);
});

Then(
  'the XML should not contain a {string} attribute',
  async ({}, attr: string) => {
    expect(outputFileExists()).toBe(true);
    const xmlContent = readOutputFile();
    expect(xmlContent).not.toContain(`${attr}="`);
  }
);

// ── Then: binary file indicator ──

Then(
  'the file section for {string} should show a binary file indicator',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await expect(section).toBeVisible({ timeout: 10000 });
    // Binary files show a "Binary file" indicator instead of diff content
    await expect(section).toContainText(/[Bb]inary/);
  }
);
