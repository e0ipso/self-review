import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createDesktopSession } from './desktop-session';
import { captureDesktopPublication, createDesktopPublication } from './publication';
import { ReviewPublishError } from '../../packages/core/src/review-publisher';
import type { ReviewState } from '../shared/types';

let root: string;
beforeEach(() => {
  root = fs.mkdtempSync(join(tmpdir(), 'desktop-publication-'));
});
afterEach(() => {
  vi.restoreAllMocks();
  fs.rmSync(root, { recursive: true, force: true });
});

function fixture() {
  const desktop = createDesktopSession(root);
  const source = { type: 'directory' as const, sourcePath: root };
  desktop.review.diffData = { source, files: [] };
  fs.writeFileSync(desktop.output.path, 'previous document');
  const state: ReviewState = { timestamp: '2026-01-01T00:00:00Z', source, files: [] };
  return { desktop, state, publication: createDesktopPublication(desktop) };
}

it.each(['missing', 'welcome', 'loading', 'foreign'] as const)(
  'the concrete publisher refuses %s source before any output changes',
  async kind => {
    const { desktop, state, publication } = fixture();
    if (kind === 'missing') desktop.review.diffData = null;
    else if (kind === 'foreign') state.source = { type: 'directory', sourcePath: '/foreign' };
    else desktop.review.diffData = { source: { type: kind }, files: [] };
    await expect(publication.publish(state, new AbortController().signal)).rejects.toMatchObject({
      code: 'validation-failed',
    });
    expect(fs.readFileSync(desktop.output.path, 'utf8')).toBe('previous document');
    expect(fs.readdirSync(root)).toEqual(['review.xml']);
  }
);

it('strips local spoof provenance before real atomic publication', async () => {
  const { desktop, state, publication } = fixture();
  await publication.publish(
    {
      ...state,
      remoteUrl: 'https://gitlab.com/forged/repo/-/merge_requests/1',
      remoteForge: 'gitlab',
      remoteBaseSha: 'forged-base',
      remoteHeadSha: 'forged-head',
    },
    new AbortController().signal
  );
  const xml = fs.readFileSync(desktop.output.path, 'utf8');
  expect(xml).not.toContain('remote-');
  expect(xml).toContain(`source-path="${root}"`);
});

it('publishes the loaded remote metadata even when the separate desktop cache disagrees', async () => {
  const { desktop, state, publication } = fixture();
  const remote = {
    remoteUrl: 'https://github.com/o/r/pull/1',
    remoteForge: 'github' as const,
    remoteBaseSha: 'aaa',
    remoteHeadSha: 'bbb',
    temporaryClone: true,
    threadSyncAvailable: false,
  };
  desktop.review.diffData!.remote = remote;
  desktop.remoteInfo = { ...remote, remoteHeadSha: 'stale-desktop-cache' };
  await publication.publish(
    { ...state, remoteUrl: 'forged', remoteHeadSha: 'forged' },
    new AbortController().signal
  );
  const xml = fs.readFileSync(desktop.output.path, 'utf8');
  expect(xml).toContain('remote-url="https://github.com/o/r/pull/1"');
  expect(xml).toContain('remote-head-sha="bbb"');
  expect(xml).not.toContain('forged');
  expect(xml).not.toContain('stale-desktop-cache');
  expect(xml).not.toContain('source-path');
  expect(xml).not.toContain('repository=');
});

it('refuses replaced or mutated loads captured before asynchronous work', () => {
  const { desktop, state } = fixture();
  const prepare = captureDesktopPublication(desktop.review, desktop.output.path);
  desktop.review.diffData = { ...desktop.review.diffData! };
  expect(() => prepare(state)).toThrow(ReviewPublishError);
  const next = captureDesktopPublication(desktop.review, desktop.output.path);
  desktop.review.diffData.source = { type: 'directory', sourcePath: '/other' };
  expect(() => next(state)).toThrow(ReviewPublishError);
});

it('keeps committed publication successful if diagnostics throw', async () => {
  const { desktop, state, publication } = fixture();
  vi.spyOn(console, 'error').mockImplementation(() => {
    throw new Error('broken diagnostics');
  });
  await expect(publication.publish(state, new AbortController().signal)).resolves.toBeUndefined();
  expect(fs.readFileSync(desktop.output.path, 'utf8')).toContain('<review');
});
