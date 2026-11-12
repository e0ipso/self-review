import { afterEach, expect, it, vi } from 'vitest';
import * as fs from 'node:fs/promises';
import { resolveStartupSourceAsync } from './startup-mode';
import type { ForgeCommandRunner } from './forge-provider';

vi.mock('fs/promises', async importOriginal => {
  const original = await importOriginal<typeof fs>();
  return { ...original, stat: vi.fn(original.stat) };
});
afterEach(() => vi.mocked(fs.stat).mockReset());
const runner = vi.fn<ForgeCommandRunner>(async () => ({ stdout: '', stderr: '', exitCode: 1 }));

it('checks cancellation before invoking native stat', async () => {
  const controller = new AbortController();
  controller.abort();
  runner.mockClear();
  await expect(
    resolveStartupSourceAsync(['a.txt'], '/virtual', { signal: controller.signal, runner })
  ).rejects.toMatchObject({
    name: 'CommandCancelledError',
    reason: 'aborted',
    command: 'git',
    args: ['rev-parse', '--git-dir'],
    message: 'git rev-parse --git-dir was cancelled',
  });
  expect(fs.stat).not.toHaveBeenCalled();
  expect(runner).not.toHaveBeenCalled();
});

it.each(['resolve', 'reject'] as const)(
  'joins native stat %s before propagating cancellation',
  async outcome => {
    const controller = new AbortController();
    let release!: () => void;
    const stats = { isFile: () => true, isDirectory: () => false } as Awaited<
      ReturnType<typeof fs.stat>
    >;
    vi.mocked(fs.stat).mockImplementation(
      () =>
        new Promise((resolve, reject) => {
          release = () =>
            outcome === 'resolve' ? resolve(stats) : reject(new Error('stat failed'));
        })
    );
    runner.mockClear();
    let settled = false;
    const observed = resolveStartupSourceAsync(['a.txt'], '/virtual', {
      signal: controller.signal,
      runner,
    }).then(
      value => {
        settled = true;
        return { value };
      },
      error => {
        settled = true;
        return { error };
      }
    );
    expect(fs.stat).toHaveBeenCalledExactlyOnceWith('/virtual/a.txt');
    controller.abort();
    await Promise.resolve();
    expect(settled).toBe(false);
    release();
    expect(await observed).toMatchObject({
      error: { name: 'CommandCancelledError', reason: 'aborted' },
    });
    expect(runner).not.toHaveBeenCalled();
  }
);
