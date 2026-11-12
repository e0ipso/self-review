import { setImmediate } from 'node:timers/promises';
import { expect, it, vi } from 'vitest';
import { replaceReviewAsync } from './replacement-delivery';
import type { DiffLoadPayload } from '../shared/types';
import { IPC } from '../shared/ipc-channels';

function fixture() {
  const payload: DiffLoadPayload = {
    source: { type: 'directory', sourcePath: '/review' },
    files: [
      {
        oldPath: '',
        newPath: 'a.ts',
        changeType: 'added',
        isBinary: false,
        hunks: [
          {
            header: '@@ -0,0 +1,100000 @@',
            oldStart: 0,
            oldLines: 0,
            newStart: 1,
            newLines: 100000,
            lines: Array.from({ length: 100000 }, (_, index) => ({
              type: 'addition',
              content: '',
              newLineNumber: index + 1,
              oldLineNumber: null,
            })),
          },
        ],
      },
    ],
  };
  const abort = new AbortController();
  const current = vi.fn();
  const send = vi.fn();
  const adopt = vi.fn();
  const guide = { overview: 'orientation', groups: [] };
  const resume = { comments: [], viewedFiles: [] };
  const owner = { signal: abort.signal, assertCurrent: current, send };
  return { content: { payload, guide, resume }, abort, owner, adopt };
}

it.each(['cancel', 'stale'] as const)(
  'keeps the previous review intact after %s during a yielded preparation',
  async mode => {
    const f = fixture();
    const preparing = vi.fn();
    const work = replaceReviewAsync(f.content, f.owner, f.adopt, preparing);
    const rejected = expect(work).rejects.toThrow('owner changed');
    await setImmediate();
    expect(f.adopt).not.toHaveBeenCalled();
    if (mode === 'cancel') f.abort.abort(new Error('owner changed'));
    else
      preparing.mockImplementation(() => {
        throw new Error('owner changed');
      });
    await rejected;
    expect(f.adopt).not.toHaveBeenCalled();
    expect(f.owner.send).not.toHaveBeenCalled();
  }
);

it('prepares all pieces before adoption and sends them in order without yielding after it', async () => {
  const f = fixture();
  let adopted = false;
  const preparing = vi.fn(() => {
    if (adopted) throw new Error('old transition after adoption');
  });
  f.adopt.mockImplementation(() => {
    adopted = true;
    queueMicrotask(() => f.abort.abort(new Error('later cancellation')));
  });
  await replaceReviewAsync(f.content, f.owner, f.adopt, preparing);
  expect(f.adopt).toHaveBeenCalledOnce();
  expect(f.owner.send.mock.calls.map(([channel]) => channel)).toEqual([
    IPC.DIFF_LOAD,
    IPC.GUIDE_LOAD,
    IPC.RESUME_LOAD,
  ]);
  const wire = f.owner.send.mock.calls[0][1] as DiffLoadPayload;
  expect(wire).not.toBe(f.content.payload);
  expect(wire.source).toBe(f.content.payload.source);
  expect(wire.files[0].hunks).toBe(f.content.payload.files[0].hunks);
  expect(f.owner.send.mock.calls[1][1]).toBe(f.content.guide);
  expect(f.owner.send.mock.calls[2][1]).toBe(f.content.resume);
});

it('stops later ordered sends after losing the peer without undoing adoption', async () => {
  const f = fixture();
  f.content.payload.files = [];
  let current = true;
  f.owner.assertCurrent.mockImplementation(() => {
    if (!current) throw new Error('peer changed');
  });
  f.owner.send.mockImplementation(() => {
    current = false;
  });
  await expect(replaceReviewAsync(f.content, f.owner, f.adopt)).rejects.toThrow('peer changed');
  expect(f.adopt).toHaveBeenCalledOnce();
  expect(f.owner.send).toHaveBeenCalledOnce();
  expect(f.owner.send.mock.calls[0][0]).toBe(IPC.DIFF_LOAD);
});
