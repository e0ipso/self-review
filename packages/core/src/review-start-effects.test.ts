import { afterEach, describe, expect, it, vi } from 'vitest';
import { constants, Stats } from 'node:fs';
import { prepareDirectoryReview } from './review-start';
import type { ScanFsLayer } from './scan-fs';
import { CommandCancelledError } from './forge-provider';

const host = vi.hoisted(() =>
  vi.fn(() => {
    throw new Error('host filesystem consulted');
  })
);
vi.mock('fs', async original => ({
  ...(await original<typeof import('fs')>()),
  realpathSync: host,
  statSync: host,
}));
vi.mock('fs/promises', async original => ({
  ...(await original<typeof import('fs/promises')>()),
  stat: host,
}));
afterEach(() => {
  expect(host).not.toHaveBeenCalled();
  host.mockClear();
  vi.restoreAllMocks();
});
function scanFs(): ScanFsLayer {
  const bytes = Buffer.from('virtual text\n');
  const metadata = (target: string): Stats =>
    Object.assign(Object.create(Stats.prototype) as Stats, {
      dev: 1,
      ino: target === '/virtual' ? 1 : 2,
      size: bytes.length,
      mode: (target === '/virtual' ? constants.S_IFDIR : constants.S_IFREG) | 0o644,
    });
  return {
    readAllocation: 'bounded',
    stat: async target => metadata(target),
    lstat: async target => metadata(target),
    realpath: async target => target,
    readlink: async () => {
      throw new Error('not a link');
    },
    opendir: async () => {
      throw new Error('file must not be scanned as a directory');
    },
    open: async target => {
      let cursor = 0;
      return {
        stat: async () => metadata(target),
        close: async () => {},
        async read(buffer, offset, length, position) {
          const start = position ?? cursor;
          const bytesRead = bytes.copy(buffer, offset, start, start + length);
          if (position === null) cursor += bytesRead;
          return { bytesRead };
        },
      };
    },
  };
}
describe('review start effects', () => {
  it('consumes rejected asynchronous diagnostics without replacing the review result', async () => {
    const pending = Promise.reject(new Error('asynchronous presentation failed'));
    const observed = vi.spyOn(pending, 'then');
    try {
      const result = await prepareDirectoryReview({ config: null }, '/virtual/file.txt', {
        scanFs: scanFs(),
        reportDiagnostic: () => pending,
      });
      expect(result.payload.files).toHaveLength(1);
      expect(observed).toHaveBeenCalled();
    } finally {
      // The original implementation must fail without leaking this controlled rejection.
      void pending.catch(() => {});
    }
  });

  it('classifies and resolves a virtual file through its supplied scan and captures diagnostics', async () => {
    const reportDiagnostic = vi.fn();
    const result = await prepareDirectoryReview({ config: null }, '/virtual/file.txt', {
      scanFs: scanFs(),
      reportDiagnostic,
    });
    expect(result.payload.source).toEqual({ type: 'file', sourcePath: '/virtual/file.txt' });
    expect(result.payload.files[0].hunks[0].lines[0].content).toBe('virtual text');
    expect(result.identity).toMatchObject({
      sourceRoot: '/virtual',
      newSide: { kind: 'file', path: '/virtual/file.txt' },
    });
    expect(reportDiagnostic.mock.calls[0]).toEqual([
      '[review] Starting directory review for:',
      '/virtual/file.txt',
    ]);
  });

  it('retains results when presentation throws, but still propagates cancellation', async () => {
    const reportDiagnostic = () => {
      throw new Error('presentation failed');
    };
    const result = await prepareDirectoryReview({ config: null }, '/virtual/file.txt', {
      scanFs: scanFs(),
      reportDiagnostic,
    });
    expect(result.payload.files).toHaveLength(1);
    const controller = new AbortController();
    await expect(
      prepareDirectoryReview({ config: null }, '/virtual/file.txt', {
        scanFs: scanFs(),
        signal: controller.signal,
        reportDiagnostic() {
          controller.abort();
          throw new Error('presentation failed');
        },
      })
    ).rejects.toBeInstanceOf(CommandCancelledError);
  });
});
