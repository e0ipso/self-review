/**
 * Webapp step definitions for Feature 11: Applying a Suggestion.
 *
 * The harness adapter grows its apply half from URL params (see
 * tests/webapp/main.tsx), so each Given here names a host rather than a
 * fixture: one that cannot write, one that applies, one that refuses, and
 * the two remote sessions whose destination is or is not the reviewed tree.
 */
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { launchWebapp, getPage, triggerCommentIcon } from './app';

const { Given, When, Then } = createBdd();

const CONTROL = '[data-testid="suggestion-apply"]';
const APPLY_BUTTON = '[data-testid="suggestion-apply-button"]';
const CHOOSE_BUTTON = '[data-testid="suggestion-apply-choose-destination"]';
const OUTCOME = '[data-testid="suggestion-apply-outcome"]';

/** Scope every apply assertion to the block the suggestion lives in. */
function suggestionBlock() {
  return getPage().locator('[data-testid="suggestion-block"]').first();
}

// ── Given: the host ──

Given('the webapp is loaded with a host that applies suggestions', async () => {
  await launchWebapp({ apply: 'applied' });
});

Given('the webapp is loaded with a host that refuses to apply suggestions', async () => {
  await launchWebapp({ apply: 'refused' });
});

Given(
  'the webapp is loaded with a temporary-clone remote session and a destination picker that answers {string}',
  async ({}, answer: string) => {
    await launchWebapp({ apply: 'applied', remote: 'temporary', destination: answer });
  }
);

Given(
  'the webapp is loaded with a reused-clone remote session and a destination picker that answers {string}',
  async ({}, answer: string) => {
    await launchWebapp({ apply: 'applied', remote: 'reused', destination: answer });
  }
);

// ── Given: a suggestion to apply ──

Given(
  'I have added a comment with a suggestion on new line {int} of {string}',
  async ({}, line: number, filePath: string) => {
    await triggerCommentIcon(filePath, line, 'new');
    const page = getPage();
    await page.locator('[data-testid="comment-input"] textarea').fill('Suggestion comment');
    await page.locator('[data-testid="add-suggestion-btn"]').click();
    await page.locator('[data-testid="suggestion-proposed"] textarea').fill('const fixed = true;');
    await page.locator('[data-testid="add-comment-btn"]').click();
    await expect(suggestionBlock()).toBeVisible();
  }
);

// ── When ──

When('I click {string} on that suggestion', async ({}, label: string) => {
  const selector = label === 'Apply' ? APPLY_BUTTON : CHOOSE_BUTTON;
  await suggestionBlock().locator(selector).click();
});

// ── Then ──

Then('the suggestion should offer no apply control', async () => {
  await expect(suggestionBlock().locator(CONTROL)).toHaveCount(0);
});

Then('the suggestion should offer an apply button', async () => {
  await expect(suggestionBlock().locator(APPLY_BUTTON)).toBeVisible();
  await expect(suggestionBlock().locator(CHOOSE_BUTTON)).toHaveCount(0);
});

Then('the suggestion should offer no apply button', async () => {
  await expect(suggestionBlock().locator(CONTROL)).toBeVisible();
  await expect(suggestionBlock().locator(APPLY_BUTTON)).toHaveCount(0);
  await expect(suggestionBlock().locator(CHOOSE_BUTTON)).toHaveCount(0);
});

Then('the suggestion should offer to choose a destination', async () => {
  // Enabled, not merely present: the button disables itself while an
  // attempt is in flight, so this also waits out a click that resolved
  // without changing anything.
  await expect(suggestionBlock().locator(CHOOSE_BUTTON)).toBeEnabled();
  await expect(suggestionBlock().locator(APPLY_BUTTON)).toHaveCount(0);
});

Then('the suggestion should report {string}', async ({}, status: string) => {
  await expect(suggestionBlock().locator(OUTCOME)).toHaveAttribute('data-status', status);
});

Then(
  'the suggestion should report {string} with reason {string}',
  async ({}, status: string, reason: string) => {
    const outcome = suggestionBlock().locator(OUTCOME);
    await expect(outcome).toHaveAttribute('data-status', status);
    await expect(outcome).toHaveAttribute('data-reason', reason);
  }
);

Then('the suggestion should report no apply outcome', async () => {
  await expect(suggestionBlock().locator(OUTCOME)).toHaveCount(0);
});

Then('the apply control should read {string}', async ({}, text: string) => {
  await expect(suggestionBlock().locator(CONTROL)).toContainText(text);
});
