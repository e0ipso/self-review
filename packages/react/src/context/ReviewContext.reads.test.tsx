import React, { StrictMode } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { DiffFile, ExpandContextResponse } from '@self-review/types';
import type { ReviewAdapter } from '../adapter';
import { ConfigProvider } from './ConfigContext';
import { ReviewAdapterProvider } from './ReviewAdapterContext';
import { ReviewProvider, useReview, type ReviewContextValue } from './ReviewContext';
import { installBrowserApiStubs } from '../test-helpers';
installBrowserApiStubs();
afterEach(cleanup);
const files: DiffFile[] = [
  { oldPath: 'a', newPath: 'a', changeType: 'modified', isBinary: false, hunks: [] },
];
const source = { type: 'git' as const, repository: '/repo', gitDiffArgs: '' };
function fixture(adapter: ReviewAdapter) {
  let review!: ReviewContextValue;
  function Probe() {
    review = useReview();
    return null;
  }
  const content = (host: ReviewAdapter, input = files) => (
    <StrictMode>
      <ReviewAdapterProvider adapter={host}>
        <ConfigProvider>
          <ReviewProvider initialFiles={input} initialSource={source}>
            <Probe />
          </ReviewProvider>
        </ConfigProvider>
      </ReviewAdapterProvider>
    </StrictMode>
  );
  const view = render(content(adapter));
  return {
    view,
    review: () => review,
    update: (host = adapter, input = files) => view.rerender(content(host, input)),
  };
}
it('uses a reads-only host through the public command without changing its return shape', async () => {
  const expand = vi.fn(async () => ({ hunks: [], totalLines: 7 }));
  const f = fixture({ loadDiff: vi.fn(), reads: { expandContext: expand } });
  await expect(f.review().expandFileContext('a', 5)).resolves.toEqual({ hunks: [], totalLines: 7 });
  expect(expand.mock.calls[0]).toEqual([
    { filePath: 'a', contextLines: 5 },
    expect.any(AbortSignal),
  ]);
});
it.each(['snapshot', 'adapter', 'unmount'] as const)(
  'aborts public reads on %s replacement, but not an unrelated edit',
  async kind => {
    let resolve!: (value: ExpandContextResponse) => void;
    let signal!: AbortSignal;
    const adapter: ReviewAdapter = {
      loadDiff: vi.fn(),
      reads: {
        expandContext: (_request, owned) => {
          signal = owned;
          return new Promise(yes => {
            resolve = yes;
          });
        },
      },
    };
    const f = fixture(adapter);
    const pending = f.review().expandFileContext('a', 5);
    act(() => f.review().toggleViewed('a'));
    expect(signal.aborted).toBe(false);
    if (kind === 'unmount') f.view.unmount();
    else if (kind === 'adapter') f.update({ ...adapter });
    else
      f.update(
        adapter,
        files.map(file => ({ ...file }))
      );
    expect(signal.aborted).toBe(true);
    await act(async () => resolve({ hunks: [], totalLines: 9 }));
    await expect(pending).resolves.toBeNull();
  }
);
it('keeps legacy hosts, unsupported reads and manual failure repair usable', async () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => {});
  const expand = vi
    .fn<NonNullable<ReviewAdapter['expandContext']>>()
    .mockRejectedValueOnce(new Error('offline'))
    .mockResolvedValueOnce({ hunks: [], totalLines: 4 });
  const f = fixture({ loadDiff: vi.fn(), expandContext: expand });
  await expect(f.review().expandFileContext('a', 5)).resolves.toBeNull();
  expect(error).toHaveBeenCalledOnce();
  expect(expand).toHaveBeenCalledOnce();
  await expect(f.review().expandFileContext('a', 5)).resolves.toEqual({ hunks: [], totalLines: 4 });
  expect(expand.mock.calls[1]).toEqual([{ filePath: 'a', contextLines: 5 }]);
  f.update({ loadDiff: vi.fn() });
  await expect(f.review().expandFileContext('a', 5)).resolves.toBeNull();
});
