/**
 * Step definitions for Feature 06: File Viewed Status.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { getPage, readOutputFile } from './app';

const { When, Then } = createBdd();

// ── When: viewed checkbox interactions ──

When(
  'I check the "Viewed" checkbox on the {string} file section header',
  async ({}, filePath: string) => {
    const page = getPage();
    const checkbox = page.locator(`[data-testid="viewed-${filePath}"]`);
    await checkbox.click();
  }
);

When(
  'I uncheck the "Viewed" checkbox on the {string} file section header',
  async ({}, filePath: string) => {
    const page = getPage();
    const checkbox = page.locator(`[data-testid="viewed-${filePath}"]`);
    await checkbox.click();
  }
);

// ── Then: viewed status assertions ──

Then(
  'the "Viewed" checkbox for {string} should be unchecked',
  async ({}, filePath: string) => {
    const page = getPage();
    const button = page.locator(`[data-testid="viewed-${filePath}"]`);
    // Check for EyeOff icon (unviewed state)
    await expect(button.locator('svg')).toBeVisible();
  }
);

Then(
  'the "Viewed" checkbox for {string} should be checked',
  async ({}, filePath: string) => {
    const page = getPage();
    const button = page.locator(`[data-testid="viewed-${filePath}"]`);
    // Check for Eye icon (viewed state)
    await expect(button.locator('svg')).toBeVisible();
  }
);

Then(
  'the output file should contain a file element for {string} with viewed={string}',
  async ({}, filePath: string, viewedValue: string) => {
    const xmlContent = readOutputFile();
    const regex = new RegExp(
      `<file[^>]*path="${filePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"[^>]*viewed="${viewedValue}"`
    );
    expect(xmlContent).toMatch(regex);
  }
);
