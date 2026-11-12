import { afterEach, expect, it, vi } from 'vitest';
import type { ElectronAPI, ReviewState } from '../shared/types';
import { createDesktopPublicationClient } from './desktop-publication-client';

const state: ReviewState = {
  timestamp: '2026-11-12T10:00:00Z',
  source: { type: 'directory', sourcePath: '/review' },
  files: [],
};
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(yes => {
    resolve = yes;
  });
  return { promise, resolve };
}
function fixture(reply: unknown = { status: 'saved', receipt: 'existing receipt / 42' }) {
  const api = {
    saveReview: vi.fn(async () => reply) as ReturnType<
      typeof vi.fn<NonNullable<ElectronAPI['saveReview']>>
    >,
    acknowledgeReviewSave: vi.fn(),
    getSaveResult: vi.fn(async () => reply) as ReturnType<
      typeof vi.fn<NonNullable<ElectronAPI['getSaveResult']>>
    >,
  };
  return { api, client: createDesktopPublicationClient(api) };
}
afterEach(() => vi.useRealTimers());

it.each([
  null,
  [],
  {},
  { status: 'other' },
  { status: 'saved' },
  { status: 'saved', receipt: '' },
  { status: 'saved', receipt: 1 },
  { status: 'failed', message: 'oops' },
  { status: 'failed', message: 3, detail: 'oops' },
  { status: 'busy' },
])('never acknowledges or treats an invalid/unknown reply as a known failure: %j', async reply => {
  const { api, client } = fixture(reply);
  await expect(client.publish(state)).rejects.toMatchObject({ uncertain: true });
  await expect(client.inspect(() => true)).rejects.toMatchObject({ uncertain: true });
  expect(api.acknowledgeReviewSave).not.toHaveBeenCalled();
  expect(api.saveReview).toHaveBeenCalledExactlyOnceWith(state);
  client.dispose();
});

it('keeps existing arbitrary receipt strings and acknowledges only saved replies', async () => {
  const { api, client } = fixture();
  await client.publish(state);
  expect(api.acknowledgeReviewSave).toHaveBeenCalledExactlyOnceWith('existing receipt / 42');
  await client.inspect(() => true);
  expect(api.acknowledgeReviewSave).toHaveBeenCalledTimes(2);
  expect(api.saveReview).toHaveBeenCalledOnce();
});

it('retains the exact known failure message and detail without acknowledgement', async () => {
  const { api, client } = fixture({ status: 'failed', message: 'Disk full', detail: 'Free space' });
  await expect(client.publish(state)).rejects.toMatchObject({
    uncertain: false,
    message: 'Disk full',
    details: ['Free space'],
  });
  expect(api.acknowledgeReviewSave).not.toHaveBeenCalled();
});

it.each([false, true])('handles synchronous transport throws, uncertain=%s', async uncertain => {
  const { api, client } = fixture();
  api.saveReview.mockImplementation(() => {
    throw Object.assign(new Error('Disconnected'), { uncertain });
  });
  await expect(client.publish(state)).rejects.toMatchObject({ uncertain });
  expect(api.acknowledgeReviewSave).not.toHaveBeenCalled();
});

it('keeps acknowledgement failures uncertain even with a no-commit marker', async () => {
  const { api, client } = fixture();
  api.acknowledgeReviewSave.mockImplementation(() => {
    throw Object.assign(new Error('Lost ack'), { uncertain: false });
  });
  await expect(client.publish(state)).rejects.toMatchObject({ uncertain: true });
});

it.each(['timeout', 'dispose', 'stop', 'replacement'] as const)(
  'drops late publication receipts after %s and clears all timers',
  async mode => {
    vi.useFakeTimers();
    const reply = deferred<Awaited<ReturnType<NonNullable<ElectronAPI['saveReview']>>>>();
    const { api, client } = fixture();
    api.saveReview.mockReturnValue(reply.promise);
    let current = true;
    const result = client.publish(state, () => current).catch(error => error);
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(60_000);
    if (mode === 'dispose') client.dispose();
    if (mode === 'stop') client.stopWaiting();
    if (mode === 'replacement') current = false;
    reply.resolve({ status: 'saved', receipt: 'late' });
    expect(await result).toMatchObject({ uncertain: true });
    expect(api.acknowledgeReviewSave).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
    expect(api.saveReview).toHaveBeenCalledOnce();
  }
);

it('bounds inspection, ignores its late receipt and never republishes', async () => {
  vi.useFakeTimers();
  const reply = deferred<Awaited<ReturnType<NonNullable<ElectronAPI['getSaveResult']>>>>();
  const { api, client } = fixture();
  api.getSaveResult.mockReturnValue(reply.promise);
  const result = client.inspect(() => true).catch(error => error);
  await vi.advanceTimersByTimeAsync(60_000);
  expect(await result).toMatchObject({ uncertain: true });
  reply.resolve({ status: 'saved', receipt: 'late inspection' });
  await Promise.resolve();
  expect(api.acknowledgeReviewSave).not.toHaveBeenCalled();
  expect(api.saveReview).not.toHaveBeenCalled();
  expect(vi.getTimerCount()).toBe(0);
});

it('does not interpret inspection transport failures as proof an earlier write failed', async () => {
  const { api, client } = fixture();
  api.getSaveResult.mockImplementation(() => {
    throw Object.assign(new Error('No result'), { uncertain: false });
  });
  await expect(client.inspect(() => true)).rejects.toMatchObject({ uncertain: true });
});

it.each(['none', 'save-only', 'ack-only'] as const)(
  'retains ordered legacy submit then quit on an incomplete modern host: %s',
  async mode => {
    const { api } = fixture();
    const client = createDesktopPublicationClient({
      ...(mode === 'save-only' ? { saveReview: api.saveReview } : {}),
      ...(mode === 'ack-only' ? { acknowledgeReviewSave: api.acknowledgeReviewSave } : {}),
    });
    const calls: string[] = [];
    const legacy = {
      submitReview: vi.fn(value => {
        expect(value).toBe(state);
        calls.push('submit');
      }),
      saveAndQuit: vi.fn(() => {
        calls.push('quit');
      }),
    };
    await expect(client.finish(state, legacy, () => true)).rejects.toMatchObject({
      uncertain: true,
    });
    expect(calls).toEqual(['submit', 'quit']);
    expect(api.saveReview).not.toHaveBeenCalled();
    expect(api.acknowledgeReviewSave).not.toHaveBeenCalled();
  }
);

it('waits for legacy handoff before quit, without publishing or fabricating success', async () => {
  const handoff = deferred<void>();
  const legacy = {
    submitReview: vi.fn(),
    handoffReview: vi.fn(() => handoff.promise),
    saveAndQuit: vi.fn(),
  };
  const client = createDesktopPublicationClient({});
  const result = client.finish(state, legacy, () => true).catch(error => error);
  expect(legacy.handoffReview).toHaveBeenCalledExactlyOnceWith(state);
  expect(legacy.saveAndQuit).not.toHaveBeenCalled();
  handoff.resolve();
  expect(await result).toMatchObject({ uncertain: true });
  expect(legacy.saveAndQuit).toHaveBeenCalledOnce();
  expect(legacy.submitReview).not.toHaveBeenCalled();
});

it('does not send legacy quit after a timed out or disposed handoff', async () => {
  vi.useFakeTimers();
  for (const mode of ['timeout', 'dispose']) {
    const handoff = deferred<void>();
    const legacy = {
      submitReview: vi.fn(),
      handoffReview: vi.fn(() => handoff.promise),
      saveAndQuit: vi.fn(),
    };
    const client = createDesktopPublicationClient({});
    const result = client.finish(state, legacy, () => true).catch(error => error);
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(60_000);
    else client.dispose();
    handoff.resolve();
    expect(await result).toMatchObject({ uncertain: true });
    await Promise.resolve();
    expect(legacy.saveAndQuit).not.toHaveBeenCalled();
    expect(legacy.submitReview).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  }
});
