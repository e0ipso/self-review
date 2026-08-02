/**
 * Webapp step definitions for Feature 10: Guided Walkthrough Mode.
 * Loads the walkthrough guide fixture through the same adapter seam the
 * Electron app uses for `guide:load` (URL param ?guide=walkthrough).
 */
import { expect } from '@playwright/test';
import { createBdd, DataTable } from 'playwright-bdd';
import { launchWebapp, getPage } from './app';

const { Given, When, Then } = createBdd();

// ── Given ──

Given('the webapp is loaded with fixture data and a walkthrough guide', async () => {
  await launchWebapp({ guide: 'walkthrough' });
});

// ── When ──

When('I switch the guide mode to {string}', async ({}, mode: string) => {
  const page = getPage();
  const testId = mode === 'Flat' ? 'guide-mode-flat' : 'guide-mode-guided';
  await page.locator(`[data-testid="${testId}"]`).click();
});

// ── Then: grouping and ordering ──

Then(
  'the file tree should show guide groups in this order:',
  async ({}, table: DataTable) => {
    const page = getPage();
    const expected = table.hashes();
    const headers = page.locator('[data-testid="file-tree"] [data-testid^="guide-group-"]');
    await expect(headers).toHaveCount(expected.length);
    for (let i = 0; i < expected.length; i++) {
      const header = headers.nth(i);
      await expect(header).toHaveAttribute(
        'data-testid',
        `guide-group-${expected[i].group}`
      );
      if (expected[i].rationale) {
        await expect(header).toContainText(expected[i].rationale);
      }
    }
  }
);

Then(
  'the file tree should list files in this order:',
  async ({}, table: DataTable) => {
    const page = getPage();
    const expectedFiles = table.hashes().map(row => row.file);
    const entries = page.locator('[data-testid="file-tree"] [data-testid^="file-entry-"]');
    await expect(entries).toHaveCount(expectedFiles.length);
    const actualFiles: string[] = [];
    for (let i = 0; i < expectedFiles.length; i++) {
      const testId = await entries.nth(i).getAttribute('data-testid');
      if (testId) actualFiles.push(testId.replace('file-entry-', ''));
    }
    expect(actualFiles).toEqual(expectedFiles);
  }
);

Then(
  '{string} should appear under guide group {string}',
  async ({}, filePath: string, groupName: string) => {
    const page = getPage();
    // Walk the tree's group headers and entries in DOM order; the group a
    // file belongs to is the nearest preceding header.
    const groupOfFile = await page.evaluate((fp: string) => {
      const nodes = document.querySelectorAll(
        '[data-testid="file-tree"] [data-testid]'
      );
      let currentGroup: string | null = null;
      for (const node of Array.from(nodes)) {
        const testId = node.getAttribute('data-testid') ?? '';
        if (testId.startsWith('guide-group-')) {
          currentGroup = testId.replace('guide-group-', '');
        } else if (testId === `file-entry-${fp}`) {
          return currentGroup;
        }
      }
      return null;
    }, filePath);
    expect(groupOfFile).toBe(groupName);
  }
);

// ── Then: guide descriptions ──

Then(
  'the file tree entry for {string} should show guide description {string}',
  async ({}, filePath: string, description: string) => {
    const page = getPage();
    const desc = page.locator(`[data-testid="guide-file-description-${filePath}"]`);
    await expect(desc).toBeVisible();
    await expect(desc).toHaveText(description);
  }
);

Then(
  'the file section for {string} should show guide description {string}',
  async ({}, filePath: string, description: string) => {
    const page = getPage();
    const desc = page.locator(`[data-testid="file-guide-description-${filePath}"]`);
    await expect(desc).toBeVisible();
    await expect(desc).toHaveText(description);
  }
);

// ── Then: overview panel ──

Then(
  'the guide overview panel should be visible above the first file section',
  async () => {
    const page = getPage();
    const overview = page.locator('[data-testid="guide-overview"]');
    await expect(overview).toBeVisible();
    // The overview must precede the first file section in document order.
    const precedesFirstSection = await page.evaluate(() => {
      const overviewEl = document.querySelector('[data-testid="guide-overview"]');
      const firstSection = document.querySelector('[data-testid^="file-section-"]');
      if (!overviewEl || !firstSection) return false;
      return Boolean(
        overviewEl.compareDocumentPosition(firstSection) &
          Node.DOCUMENT_POSITION_FOLLOWING
      );
    });
    expect(precedesFirstSection).toBe(true);
  }
);

Then('the guide overview should render a Mermaid diagram as SVG', async () => {
  const page = getPage();
  // Mermaid output keeps its render id; scoping to it excludes lucide icons.
  const svg = page.locator('[data-testid="guide-overview"] svg[id^="mermaid-"]');
  await expect(svg.first()).toBeVisible({ timeout: 10000 });
});

Then('the guide overview panel should not be visible', async () => {
  const page = getPage();
  await expect(page.locator('[data-testid="guide-overview"]')).toHaveCount(0);
});

// ── Then: regression guard ──

Then('the guide mode toggle should not be present', async () => {
  const page = getPage();
  await expect(page.locator('[data-testid="guide-mode-guided"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="guide-mode-flat"]')).toHaveCount(0);
});

Then('the file tree should show no guide groups', async () => {
  const page = getPage();
  await expect(
    page.locator('[data-testid="file-tree"] [data-testid^="guide-group-"]')
  ).toHaveCount(0);
});
