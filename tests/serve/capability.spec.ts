// The session capability end to end. The other serve specs open the printed URL; this one covers requests without the key.
import { test, expect } from '@playwright/test';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestRepo } from '../fixtures/test-repo';
import { startServe, ServeProcess } from './serve-process';

const FIXTURE_FILE_COUNT = 6;

let repoDir: string | null = null;
let outputDir: string | null = null;
let serve: ServeProcess | null = null;

test.beforeEach(async () => {
  repoDir = createTestRepo();
  outputDir = mkdtempSync(join(tmpdir(), 'self-review-serve-cap-'));
  serve = await startServe(['--output', join(outputDir, 'review.xml')], repoDir);
});

test.afterEach(() => {
  serve?.kill();
  serve = null;
  for (const dir of [repoDir, outputDir]) {
    if (dir) rmSync(dir, { recursive: true, force: true });
  }
  repoDir = null;
  outputDir = null;
});

test('the printed URL opens the review, and the key leaves the address bar', async ({ page }) => {
  expect(serve!.capability).toMatch(/^[A-Za-z0-9_-]{43}$/);

  await page.goto(serve!.url);
  await expect(page.locator('[data-testid^="file-entry-"]')).toHaveCount(FIXTURE_FILE_COUNT, {
    timeout: 15_000,
  });

  // The key is in memory now and nowhere a copied address would carry it.
  expect(page.url()).toBe(`${serve!.origin}/`);
  expect(await page.evaluate(() => window.location.hash)).toBe('');
});

test('a page opened without the fragment shows the terminal notice, not the review', async ({
  page,
}) => {
  // What a reload, a bookmark or a retyped address does.
  await page.goto(`${serve!.origin}/`);

  await expect(page.getByText('Open the URL printed in the terminal')).toBeVisible({
    timeout: 15_000,
  });
  await expect(page.locator('[data-testid="capability-notice"]')).toContainText('#');
  await expect(page.locator('[data-testid^="file-entry-"]')).toHaveCount(0);
  await expect(page.locator('[data-testid="finish-review-btn"]')).toHaveCount(0);
});

test('the page and its scripts are served without the key and never contain it', async ({
  request,
}) => {
  const index = await request.get(`${serve!.origin}/`);
  expect(index.status()).toBe(200);
  const html = await index.text();
  expect(html).not.toContain(serve!.capability);

  // Every script the page loads, as the built page references them.
  const scripts = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1]);
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) {
    const script = await request.get(new URL(src, `${serve!.origin}/`).toString());
    expect(script.status(), src).toBe(200);
    expect(await script.text()).not.toContain(serve!.capability);
  }
});

test('the API refuses a client that names the listener but has no key', async ({ request }) => {
  // The audit's reproduction: Host is right, no browser headers, no key.
  for (const route of ['/api/diff', '/api/config', '/api/resume', '/api/image?path=README.md']) {
    const res = await request.get(`${serve!.origin}${route}`);
    expect(res.status(), route).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
  }
  const submit = await request.post(`${serve!.origin}/api/review`, {
    headers: { 'content-type': 'application/json' },
    data: {},
  });
  expect(submit.status()).toBe(401);
  // Nothing was completed by that: the process is still serving.
  expect(serve!.hasExited()).toBe(false);

  // With the key, the same routes answer.
  const authorized = await request.get(`${serve!.origin}/api/diff`, {
    headers: { authorization: `Bearer ${serve!.capability}` },
  });
  expect(authorized.status()).toBe(200);
  expect((await authorized.json()).diff.files).toHaveLength(FIXTURE_FILE_COUNT);
});

test('a request from the review page itself is refused without the header', async ({ page }) => {
  await page.goto(serve!.url);
  await expect(page.locator('[data-testid^="file-entry-"]')).toHaveCount(FIXTURE_FILE_COUNT, {
    timeout: 15_000,
  });

  // Same origin and real browser headers: the capability alone decides, even if Host/Origin checks were wrong.
  const status = await page.evaluate(() => fetch('/api/diff').then(res => res.status));
  expect(status).toBe(401);
});
