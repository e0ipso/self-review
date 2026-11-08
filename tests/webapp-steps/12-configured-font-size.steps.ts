/**
 * Webapp step definitions for Feature 12: Configured font size.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { launchWebapp, getPage } from './app';

const { Given, Then } = createBdd();

Given('the webapp is loaded with font size {int}', async ({}, size: number) => {
  await launchWebapp({ fontSize: String(size) });
});

Then('the diff code text should render at {int}px', async ({}, size: number) => {
  const code = getPage().locator('[data-testid="diff-viewer"] code.sr-diff-code').first();
  await expect(code).toHaveCSS('font-size', `${size}px`);
});
