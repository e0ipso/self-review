import { expect, it, vi } from 'vitest';
import { createDesktopReads } from './desktop-reads';
import { ElectronRequests } from './electron-requests';
import type { DesktopContentAPI } from '../shared/types';

function legacy() {
  return {
    loadFileContent: vi.fn(async () => []),
    loadImage: vi.fn(async () => ({ error: 'missing' })),
    readAttachment: vi.fn(async () => null),
    expandContext: vi.fn(async () => ({ hunks: [], totalLines: 0 })),
  };
}
it('selects the complete correlated capability once and never falls back after a read refusal', async () => {
  const api: DesktopContentAPI = {
    ...legacy(),
    readContent: vi.fn(async () => ({ kind: 'file' as const, hunks: [] })),
    cancelContentRead: vi.fn(),
  };
  const readContent = api.readContent!;
  const reads = createDesktopReads(api, new ElectronRequests());
  // A later bridge mutation must not switch the already composed protocol.
  api.readContent = undefined;
  await expect(reads.loadFileContent('a', new AbortController().signal)).resolves.toEqual([]);
  expect(readContent).toHaveBeenCalledOnce();
  expect(api.loadFileContent).not.toHaveBeenCalled();
});
it.each(['none', 'read-only', 'cancel-only'] as const)(
  'supports every legacy read and explicit retry with %s modern capability',
  async mode => {
    const api: DesktopContentAPI = legacy();
    if (mode === 'read-only') api.readContent = vi.fn();
    if (mode === 'cancel-only') api.cancelContentRead = vi.fn();
    const requests = new ElectronRequests();
    const reads = createDesktopReads(api, requests);
    const signal = new AbortController().signal;
    await expect(reads.loadFileContent('a', signal)).resolves.toEqual([]);
    await expect(reads.loadImage('a', signal)).resolves.toEqual({ error: 'missing' });
    await expect(reads.readAttachment('a', signal)).resolves.toBeNull();
    await expect(reads.expandContext({ filePath: 'a', contextLines: 1 }, signal)).resolves.toEqual({
      hunks: [],
      totalLines: 0,
    });
    vi.mocked(api.loadFileContent).mockRejectedValueOnce(new Error('read failed'));
    await expect(reads.loadFileContent('a', signal)).rejects.toThrow('read failed');
    await expect(reads.loadFileContent('a', signal)).resolves.toEqual([]);
    if (api.readContent) expect(api.readContent).not.toHaveBeenCalled();
    requests.dispose();
  }
);
