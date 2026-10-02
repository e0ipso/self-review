// Screenshots land in E2E_EVIDENCE_DIR, or test-results/evidence when unset.
import * as fs from 'fs';
import * as path from 'path';
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';
import { launchWebapp, getPage } from './app';

const { Given, Then } = createBdd();

const DIAGRAM_IMAGE = 'img[alt="Mermaid diagram"]';

Given('the webapp is loaded with hostile content fixture data', async () => {
  await launchWebapp({ fixture: 'hostile-content' });
});

Then('every Mermaid block should settle as an isolated image or a contained error', async () => {
  const page = getPage();
  const view = page.locator('.rendered-markdown-view');
  // Both diagrams must leave loading as an image or an error; the overlay payload may be refused as malformed SVG.
  await expect
    .poll(() => view.locator(`${DIAGRAM_IMAGE}, [data-testid="mermaid-error"]`).count(), {
      timeout: 15000,
    })
    .toBe(2);
  const images = view.locator(DIAGRAM_IMAGE);
  expect(await images.count()).toBeGreaterThanOrEqual(1);
  const sources = await images.evaluateAll(nodes =>
    nodes.map(node => (node as HTMLImageElement).src)
  );
  for (const src of sources) {
    expect(src).toMatch(/^data:image\/svg\+xml;base64,/);
  }
});

Then('no diagram markup or stylesheet should exist in the application document', async () => {
  const page = getPage();
  const leaks = await page.evaluate(() => ({
    diagramSvgs: document.querySelectorAll('svg[id^="mermaid-"]').length,
    globalSelectorStyles: Array.from(document.querySelectorAll('style')).filter(style =>
      (style.textContent ?? '').includes(':not(#mermaid')
    ).length,
    escapedOverlays: Array.from(document.querySelectorAll('div')).filter(
      div => div.textContent === 'AUDIT OVERLAY'
    ).length,
    fixedPositioned: Array.from(document.querySelectorAll('.rendered-markdown-view *')).filter(
      el => getComputedStyle(el).position === 'fixed'
    ).length,
    renderSandboxes: document.querySelectorAll('[data-mermaid-sandbox]').length,
  }));
  expect(leaks).toEqual({
    diagramSvgs: 0,
    globalSelectorStyles: 0,
    escapedOverlays: 0,
    fixedPositioned: 0,
    renderSandboxes: 0,
  });
});

Then(
  'the rendered element containing {string} should carry no class or style attribute',
  async ({}, text: string) => {
    const page = getPage();
    const element = page.locator('.rendered-markdown-view').getByText(text, { exact: true });
    await expect(element).toBeVisible({ timeout: 10000 });
    await element.scrollIntoViewIfNeeded();
    expect(await element.getAttribute('class')).toBeNull();
    expect(await element.getAttribute('style')).toBeNull();
    const position = await element.evaluate(el => getComputedStyle(el).position);
    expect(position).toBe('static');
  }
);

Then('the review controls should stay visible and clickable', async () => {
  const page = getPage();
  const controls = [
    page.locator('[data-testid="finish-review-btn"]'),
    page.locator('[data-testid^="file-entry-"]').first(),
  ];
  for (const control of controls) {
    await expect(control).toBeVisible();
    // The topmost element at the control's centre must be the control
    // itself (or something inside it); anything else means content covers it.
    const covered = await control.evaluate(el => {
      const rect = el.getBoundingClientRect();
      const hit = document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2);
      return hit === null || !(hit === el || el.contains(hit));
    });
    expect(covered).toBe(false);
  }
  // Playwright refuses the click if another element intercepts it; #review-state is written only when it lands.
  await controls[0].click();
  await page.locator('#review-state').waitFor({ state: 'attached', timeout: 5000 });
});

Then('I save a screenshot named {string}', async ({}, name: string) => {
  const dir =
    process.env.E2E_EVIDENCE_DIR ?? path.resolve(__dirname, '../../test-results/evidence');
  fs.mkdirSync(dir, { recursive: true });
  await getPage().screenshot({ path: path.join(dir, name) });
});
