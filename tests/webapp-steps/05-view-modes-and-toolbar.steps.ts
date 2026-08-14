/**
 * Webapp step definitions for Feature 05: View Modes and Toolbar.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { getPage } from './app';

const { When, Then } = createBdd();

When(
  'I click the {string} view mode toggle in the file tree',
  async ({}, mode: string) => {
    const page = getPage();
    if (mode === 'Unified') {
      await page.locator('[data-testid="view-mode-unified"]').click();
    } else if (mode === 'Split') {
      await page.locator('[data-testid="view-mode-split"]').click();
    }
  }
);

When('I click {string} in the toolbar', async ({}, buttonText: string) => {
  const page = getPage();
  if (buttonText === 'Collapse all') {
    await page.locator('[data-testid="collapse-all-btn"]').click();
  } else if (buttonText === 'Expand all') {
    await page.locator('[data-testid="expand-all-btn"]').click();
  }
});

When(
  'I click the collapse toggle on the {string} file section header',
  async ({}, filePath: string) => {
    const page = getPage();
    const header = page.locator(`[data-testid="file-header-${filePath}"]`);
    await header.locator('[data-testid="collapse-toggle"]').click();
  }
);

When(
  'I switch the theme to {string} in the toolbar',
  async ({}, theme: string) => {
    const page = getPage();
    await page
      .locator(`[data-testid="theme-option-${theme.toLowerCase()}"]`)
      .click();
  }
);

Then(
  'the diff viewer should be in {string} view mode',
  async ({}, mode: string) => {
    const page = getPage();
    if (mode === 'split') {
      await expect(
        page.locator('[data-testid="diff-viewer"] .split-view').first()
      ).toBeVisible();
    } else if (mode === 'unified') {
      await expect(
        page.locator('[data-testid="diff-viewer"] .unified-view').first()
      ).toBeVisible();
    }
  }
);

Then('the split view should show two columns', async () => {
  const page = getPage();
  const splitView = page.locator('.split-view').first();
  const halves = splitView.locator('.split-half');
  expect(await halves.count()).toBeGreaterThanOrEqual(2);
});

Then('the unified view should show a single column layout', async () => {
  const page = getPage();
  await expect(page.locator('.unified-view').first()).toBeVisible();
});

Then(
  'the {string} file section should use {string} view',
  async ({}, filePath: string, mode: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await expect(section.locator(`.${mode}-view`).first()).toBeVisible();
  }
);

Then('all file sections should be collapsed', async () => {
  const page = getPage();
  await expect(page.locator('.file-diff-content')).toHaveCount(0);
});

Then('the diff content should not be visible for any file', async () => {
  const page = getPage();
  await expect(page.locator('.file-diff-content')).toHaveCount(0);
});

Then('all file sections should be expanded', async () => {
  const page = getPage();
  const sections = page.locator('[data-testid^="file-section-"]');
  const count = await sections.count();
  expect(count).toBeGreaterThan(0);
  for (let i = 0; i < count; i++) {
    await expect(sections.nth(i).locator('.file-diff-content')).toHaveCount(1);
  }
});

Then(
  'the {string} file section should be collapsed',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await expect(section.locator('.file-diff-content')).toHaveCount(0);
  }
);

Then(
  'the {string} file section should still be expanded',
  async ({}, filePath: string) => {
    const page = getPage();
    const section = page.locator(`[data-testid="file-section-${filePath}"]`);
    await expect(section.locator('.file-diff-content')).toHaveCount(1);
  }
);

Then('the application should use dark theme colors', async () => {
  const page = getPage();
  const hasDarkClass = await page.evaluate(() =>
    document.querySelector('.self-review')?.classList.contains('dark') ?? false
  );
  expect(hasDarkClass).toBe(true);
});

Then('the application should use light theme colors', async () => {
  const page = getPage();
  const hasDarkClass = await page.evaluate(() =>
    document.querySelector('.self-review')?.classList.contains('dark') ?? false
  );
  expect(hasDarkClass).toBe(false);
});

When(
  'I click the {string} toggle in the toolbar',
  async ({}, _label: string) => {
    const page = getPage();
    await page.locator('[data-testid="toggle-word-wrap-btn"]').click();
  }
);

Then('long lines should be wrapped by default', async () => {
  const page = getPage();
  const codeLine = page.locator('[data-testid="diff-viewer"] code').first();
  await expect(codeLine).toHaveCSS('white-space', 'pre-wrap');
});

Then('long lines should scroll horizontally', async () => {
  const page = getPage();
  const codeLine = page.locator('[data-testid="diff-viewer"] code').first();
  await expect(codeLine).toHaveCSS('white-space', 'pre');
});

When('I scroll the diff pane to the bottom', async () => {
  const page = getPage();
  const container = page.locator('[data-scroll-container="diff"]');
  await container.evaluate(el => {
    el.scrollTop = el.scrollHeight;
  });
});

Then(
  'the toolbar should remain anchored at the top of the viewport',
  async () => {
    const page = getPage();
    const toolbar = page.locator('[data-testid="toolbar"]');
    await expect(toolbar).toBeVisible();
    const box = await toolbar.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.y).toBeLessThanOrEqual(1);
  }
);

Then('the document itself should not have scrolled', async () => {
  const page = getPage();
  const scroll = await page.evaluate(() => ({
    body: document.body.scrollTop,
    html: document.documentElement.scrollTop,
  }));
  expect(scroll.body).toBe(0);
  expect(scroll.html).toBe(0);
});
