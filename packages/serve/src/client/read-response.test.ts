import { afterEach, expect, it, vi } from 'vitest';
import { createFetchAdapter, loadServeConfig } from './adapter';
import { createServeRequester } from './requester';
import { SERVER_BUSY_CODE, SERVER_BUSY_ERROR } from '../protocol';
import { DEFAULT_CONFIG } from '../../../react/src/config-defaults';

const file = { oldPath: 'a', newPath: 'a', changeType: 'modified', isBinary: false, hunks: [] };
const diff = { files: [file], source: { type: 'git', repository: '/repo', gitDiffArgs: '' } };
const response = (value: unknown, status = 200) => new Response(JSON.stringify(value), { status });
const adapters: ReturnType<typeof createFetchAdapter>[] = [];
afterEach(() => {
  adapters.splice(0).forEach(adapter => adapter.dispose());
});
function adapterFor(value: unknown, status = 200) {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(response(value, status));
  const requester = createServeRequester('key', { fetch });
  const adapter = createFetchAdapter('key', requester);
  adapters.push(adapter);
  return { adapter, fetch, requester };
}

it.each([
  ['diff', { diff: { ...diff, files: [null] }, guide: null }],
  ['diff', { diff: { ...diff, source: { type: 'git' } }, guide: null }],
  ['diff', { diff, guide: { groups: [{ name: 'group', files: null }] } }],
  ['resume', { comments: [null] }],
  ['resume', { comments: [], viewedFiles: 'a' }],
  ['resume', { comments: [], remoteDrift: { drifted: true } }],
  ['file', [{ header: '@@', lines: 'bad' }]],
  ['image', { dataUri: 12 }],
  ['context', { hunks: [], totalLines: '12' }],
  ['config', { config: { ...DEFAULT_CONFIG, categories: [null] }, outputPathInfo: null }],
  [
    'config',
    {
      config: DEFAULT_CONFIG,
      outputPathInfo: { resolvedOutputPath: '/r', outputPathWritable: 'yes' },
    },
  ],
] as const)('rejects malformed %s before delivering a read value', async (endpoint, body) => {
  const { adapter, requester } = adapterFor(body);
  const read = () => {
    switch (endpoint) {
      case 'diff':
        return adapter.loadDiff();
      case 'resume':
        return adapter.loadResumedReview!();
      case 'file':
        return adapter.loadFileContent!('a');
      case 'image':
        return adapter.loadImage!('a');
      case 'context':
        return adapter.expandContext!({ filePath: 'a', contextLines: 3 });
      case 'config':
        return loadServeConfig('key', requester);
    }
  };
  await expect(read()).rejects.toMatchObject({ code: 'malformed-read-response', uncertain: false });
});

it('does not deliver malformed diff or guide, and preserves subscriptions for explicit repair', async () => {
  const { adapter, fetch } = adapterFor({ diff: { ...diff, files: null }, guide: null });
  const deliver = vi.fn();
  adapter.onDiffLoad!(deliver);
  await expect(adapter.loadDiff()).rejects.toMatchObject({ code: 'malformed-read-response' });
  expect(deliver).not.toHaveBeenCalled();
  expect(fetch).toHaveBeenCalledOnce();
  const repaired = { ...diff, extension: { keep: true } };
  fetch.mockResolvedValueOnce(response({ diff: repaired, guide: null }));
  await expect(adapter.loadDiff()).resolves.toEqual(repaired);
  expect(deliver).toHaveBeenCalledExactlyOnceWith(repaired);
  expect(fetch).toHaveBeenCalledTimes(2);
  // Last-good data remains available to later subscribers without another read.
  const later = vi.fn();
  adapter.onDiffLoad!(later);
  await Promise.resolve();
  expect(later).toHaveBeenCalledExactlyOnceWith(repaired);
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('preserves duplicate paths, extensions and the full Core line budget', async () => {
  const lines = Array.from({ length: 100000 }, (_, index) => ({
    type: 'addition',
    content: 'x',
    oldLineNumber: null,
    newLineNumber: index + 1,
    extension: true,
  }));
  const large = {
    ...file,
    hunks: [{ header: '@@', oldStart: 0, oldLines: 0, newStart: 1, newLines: lines.length, lines }],
  };
  const payload = {
    ...diff,
    files: [
      large,
      large,
      { ...large, hunks: [{ ...large.hunks[0], lines: lines.slice(0, 50000) }] },
    ],
  };
  const { adapter } = adapterFor({ diff: payload, guide: null });
  const loaded = await adapter.loadDiff();
  expect(loaded.files).toHaveLength(3);
  expect(
    loaded.files.flatMap(file => file.hunks).reduce((count, hunk) => count + hunk.lines.length, 0)
  ).toBe(250000);
  expect(loaded.files[0].hunks[0].lines[0]).toHaveProperty('extension', true);
});

it('keeps optional resume metadata, review-level comments and attachment references intact', async () => {
  const comment = {
    id: 'root',
    filePath: '',
    lineRange: null,
    suggestion: null,
    body: '00123 &lt;',
    category: 'task',
    author: 'bot',
    severity: 'major',
    confidence: 'high',
    remoteId: 'thread',
    attachments: [{ id: 'asset', fileName: '.self-review-assets/a.png', mediaType: 'image/png' }],
    replies: [{ id: 'reply', body: 'reply', remoteId: 'reply-id' }],
    extension: true,
  };
  const payload = { comments: [comment], importDiagnostics: ['downgraded'], extension: true };
  await expect(adapterFor(payload).adapter.loadResumedReview!()).resolves.toEqual(payload);
});

const state = {
  timestamp: '2026-01-01T00:00:00Z',
  source: { type: 'directory' as const, sourcePath: '/repo' },
  files: [],
};
it.each([
  [{ code: SERVER_BUSY_CODE, error: 'A different modern diagnostic' }, 503, false],
  [{ error: SERVER_BUSY_ERROR }, 503, false],
  [{ code: 'different', error: SERVER_BUSY_ERROR }, 503, true],
  [{ code: null, error: SERVER_BUSY_ERROR }, 503, true],
  [{ error: 'A different modern diagnostic' }, 503, true],
  [{ code: SERVER_BUSY_CODE, error: SERVER_BUSY_ERROR }, 500, true],
  [{ error: 'internal error' }, 500, true],
] as const)(
  'classifies mutation admission without coupling modern policy to text: %j',
  async (body, status, uncertain) => {
    const { adapter, fetch } = adapterFor(body, status);
    await expect(adapter.publishReview!(state)).rejects.toMatchObject({ uncertain });
    expect(fetch).toHaveBeenCalledOnce();
  }
);

it('keeps a lost mutation reply uncertain without replay', async () => {
  const { adapter, fetch } = adapterFor(null);
  fetch.mockRejectedValueOnce(new Error('connection reset'));
  await expect(adapter.publishReview!(state)).rejects.toMatchObject({
    uncertain: true,
    code: 'outcome-unknown',
  });
  expect(fetch).toHaveBeenCalledOnce();
});
