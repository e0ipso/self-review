import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  appendFileSync,
  chmodSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'fs';
import { open, opendir } from 'fs/promises';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { basename, join } from 'path';
import { scanDirectory, scanFile } from './directory-scanner';
import {
  generateSyntheticDiffs,
  generateSyntheticDiffsAsync,
  loadSyntheticFiles,
  loadSyntheticFilesAsync,
} from './synthetic-diff';
import { readSyntheticSourceAsync } from './synthetic-source';
import type { AsyncFileHandle } from './safe-fs-async';
import { readIntoAsync } from './bounded-read';
import { loadLocalReview } from './startup';
import { prepareDirectoryReview, commitReviewStart } from './review-start';
import { createReviewSession } from './review-session';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { CommandCancelledError } from './forge-provider';
import { BINARY_SNIFF_BYTES, MAX_SOURCE_FILE_BYTES } from './input-budgets';
import { gitSync } from './test-support/git-env';

// Keep real files, git and owned descriptors; intercept only native operation timing/failures.
vi.mock('fs/promises', async importOriginal => {
  const actual = await importOriginal<typeof import('fs/promises')>();
  return { ...actual, open: vi.fn(actual.open), opendir: vi.fn(actual.opendir) };
});

const actual = await vi.importActual<typeof import('fs/promises')>('fs/promises');
let root: string;
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'sr-loading-')));
  vi.mocked(open).mockReset().mockImplementation(actual.open);
  vi.mocked(opendir).mockReset().mockImplementation(actual.opendir);
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

function write(name: string, contents: string | Buffer = 'hello\n') {
  mkdirSync(join(root, name, '..'), { recursive: true });
  writeFileSync(join(root, name), contents);
}

function observeReads(onRead: (name: string, count: number) => void) {
  const reads: string[] = [];
  const closes: ReturnType<typeof vi.spyOn>[] = [];
  vi.mocked(open).mockImplementation(async (...args) => {
    const handle = await actual.open(...args);
    const read = handle.read.bind(handle);
    let count = 0;
    closes.push(vi.spyOn(handle, 'close'));
    vi.spyOn(handle as Pick<AsyncFileHandle, 'read'>, 'read').mockImplementation(
      async (buffer, offset, length, position) => {
        const result = await read(buffer, offset, length, position);
        reads.push(basename(String(args[0])));
        onRead(basename(String(args[0])), ++count);
        return result;
      }
    );
    return handle;
  });
  return { reads, closes };
}

const reasons = [undefined, new Error('session replaced')];

describe('cooperative local loading', () => {
  it.each(reasons)('rejects pre-aborted scans without native work, reason %s', async reason => {
    const controller = new AbortController();
    controller.abort(reason);
    await expect(scanDirectory(root, [], { signal: controller.signal })).rejects.toBeInstanceOf(
      CommandCancelledError
    );
    await expect(scanFile(join(root, 'a'), { signal: controller.signal })).rejects.toBeInstanceOf(
      CommandCancelledError
    );
    expect(opendir).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });

  it.each(reasons)(
    'cancels inside cached traversal and closes its directory, reason %s',
    async reason => {
      mkdirSync(join(root, 'later'));
      for (let i = 0; i < 12; i++) write(`file-${i}.txt`);
      const controller = new AbortController();
      let examined = 0;
      let closed = false;
      vi.mocked(opendir).mockImplementationOnce(async (...args) => {
        const dir = await actual.opendir(...args);
        const iterator = dir[Symbol.asyncIterator]();
        Object.defineProperty(dir, Symbol.asyncIterator, {
          value: async function* () {
            try {
              for await (const entry of iterator) {
                examined++;
                if (examined === 1) setImmediate(() => controller.abort(reason));
                yield entry;
              }
            } finally {
              closed = true;
            }
          },
        });
        return dir;
      });
      await expect(scanDirectory(root, [], { signal: controller.signal })).rejects.toBeInstanceOf(
        CommandCancelledError
      );
      expect(examined).toBe(1);
      expect(closed).toBe(true);
      expect(opendir).toHaveBeenCalledTimes(1);
      expect(open).not.toHaveBeenCalled();
    }
  );

  it.each(reasons)(
    'cancels during content reads and skips later files, reason %s',
    async reason => {
      write('a.txt', 'a'.repeat(256 * 1024));
      write('z.txt');
      const controller = new AbortController();
      const observed = observeReads((_name, count) => {
        if (count === 2) setImmediate(() => controller.abort(reason));
      });
      await expect(scanDirectory(root, [], { signal: controller.signal })).rejects.toBeInstanceOf(
        CommandCancelledError
      );
      expect(observed.reads).toEqual(['a.txt', 'a.txt']);
      expect(observed.closes).toHaveLength(1);
      expect(observed.closes[0]).toHaveBeenCalledTimes(1);
    }
  );

  it.each([false, true])(
    'closes a late open after cancellation, followSymlinks=%s',
    async followSymlinks => {
      write('a.txt');
      const controller = new AbortController();
      let closed: ReturnType<typeof vi.spyOn> | undefined;
      vi.mocked(open).mockImplementationOnce(async (...args) => {
        const handle = await actual.open(...args);
        closed = vi.spyOn(handle, 'close');
        controller.abort(new Error('cancel during open'));
        return handle;
      });
      await expect(
        readSyntheticSourceAsync(join(root, 'a.txt'), { followSymlinks, signal: controller.signal })
      ).rejects.toBeInstanceOf(CommandCancelledError);
      expect(closed).toHaveBeenCalledTimes(1);
    }
  );

  it.each(['startup', 'prepare', 'untracked'] as const)(
    '%s cancellation leaves the existing review intact without returning partial files',
    async mode => {
      const session = createReviewSession();
      write('prior.txt');
      const previous = await prepareDirectoryReview(session, join(root, 'prior.txt'));
      commitReviewStart(session, previous.payload, previous.identity);
      const priorData = session.diffData;
      const priorPaths = session.reviewedPaths;
      const priorIdentity = session.sourceIdentity;
      if (mode === 'untracked') {
        gitSync(['init', '-q', root]);
        gitSync([
          '-C',
          root,
          '-c',
          'user.name=Test',
          '-c',
          'user.email=test@example.com',
          'commit',
          '--allow-empty',
          '-qm',
          'base',
        ]);
      }
      write('a.txt', 'a'.repeat(256 * 1024));
      write('z.txt');
      const controller = new AbortController();
      const observed = observeReads(name => {
        if (name === 'a.txt') setImmediate(() => controller.abort(new Error('session replaced')));
      });
      const task =
        mode === 'startup'
          ? loadLocalReview(
              { mode: 'directory', sourcePath: root },
              [],
              { ignore: [] },
              root,
              () => {},
              { signal: controller.signal }
            )
          : mode === 'prepare'
            ? prepareDirectoryReview(session, root, { signal: controller.signal })
            : loadGitDiffWithUntracked([], root, { signal: controller.signal });
      await expect(task).rejects.toBeInstanceOf(CommandCancelledError);
      expect(observed.reads).toEqual(['a.txt']);
      expect(observed.closes[0]).toHaveBeenCalledTimes(1);
      expect(session.diffData).toBe(priorData);
      expect(session.reviewedPaths).toBe(priorPaths);
      expect(session.sourceIdentity).toBe(priorIdentity);
    }
  );

  it('yields between immediately resolved read chunks without using a native descriptor', async () => {
    const controller = new AbortController();
    const reader = {
      read: vi.fn(async () => {
        setImmediate(() => controller.abort(new Error('stop')));
        return { bytesRead: 64 * 1024 };
      }),
    };
    await expect(
      readIntoAsync(reader, Buffer.alloc(256 * 1024), 0, 256 * 1024, controller.signal)
    ).rejects.toBeInstanceOf(CommandCancelledError);
    expect(reader.read).toHaveBeenCalledTimes(1);
  });
});

describe('async source safety and equivalence', () => {
  it('preserves exact text, path quoting, binary/link/mode policy, omissions and ordering', async () => {
    const entries = [
      ['empty', ''],
      ['no-newline', 'last'],
      ['crlf', 'one\r\ntwo\r\n'],
      ['bom', '\uFEFFtitle\n'],
      ['café\nname', '你好\n'],
      ['exec', '#!/bin/sh\n'],
      ['large', 'x'.repeat(100)],
      ['binary', Buffer.from([0, 1, 2])],
    ] as const;
    for (const [name, content] of entries) write(name, content);
    chmodSync(join(root, 'exec'), 0o755);
    symlinkSync('no-newline', join(root, 'link'));
    execFileSync('mkfifo', [join(root, 'pipe')]);
    const names = [...entries.map(([name]) => name), 'link', 'pipe', 'gone'];
    const options = { budgets: { maxFileBytes: 64, maxTotalBytes: 160 } };
    expect(await generateSyntheticDiffsAsync(names, root, options)).toEqual(
      generateSyntheticDiffs(names, root, options)
    );
    expect(await loadSyntheticFilesAsync(names, root, options)).toEqual(
      loadSyntheticFiles(names, root, options)
    );
    const sorted = entries.map(([name]) => name).sort();
    const directory = await scanDirectory(root, ['link', 'pipe'], options);
    expect(directory.files).toEqual(loadSyntheticFiles(sorted, root, options).files);
    expect(directory.diagnostics).toEqual(loadSyntheticFiles(sorted, root, options).diagnostics);
    const single = await scanFile(join(root, 'link'));
    expect(single.files).toEqual(
      loadSyntheticFiles(['link'], root, { followSymlinks: true }).files
    );
    expect(single.files[0].hunks[0].lines[0].content).toBe('last');
  });

  it('uses the same synthetic result for real git untracked files', async () => {
    gitSync(['init', '-q', root]);
    gitSync([
      '-C',
      root,
      '-c',
      'user.name=Test',
      '-c',
      'user.email=test@example.com',
      'commit',
      '--allow-empty',
      '-qm',
      'base',
    ]);
    write('a.txt', '\uFEFFhello\r\n');
    write('b.txt', 'last');
    const expected = loadSyntheticFiles(['a.txt', 'b.txt'], root);
    const result = await loadGitDiffWithUntracked([], root);
    expect(result.files).toEqual(expected.files.map(file => ({ ...file, isUntracked: true })));
    expect(result.diagnostics).toEqual(expected.diagnostics);
  });

  it('preserves sniff and aggregate boundaries, including a file exactly at the byte limit', async () => {
    write('edge', 'e'.repeat(MAX_SOURCE_FILE_BYTES));
    expect(await readSyntheticSourceAsync(join(root, 'edge'))).toMatchObject({
      kind: 'text',
      bytesRead: MAX_SOURCE_FILE_BYTES,
    });
    write('binary', Buffer.alloc(200 * 1024));
    expect(await readSyntheticSourceAsync(join(root, 'binary'), { maxFileBytes: 10 })).toEqual({
      kind: 'binary',
      bytesRead: BINARY_SNIFF_BYTES,
    });
    write('a', 'a'.repeat(60));
    write('b', 'b'.repeat(60));
    write('c', 'c');
    const options = { budgets: { maxTotalBytes: 100 } };
    const result = await loadSyntheticFilesAsync(['a', 'b', 'c'], root, options);
    expect(result).toEqual(loadSyntheticFiles(['a', 'b', 'c'], root, options));
    expect(
      result.files.slice(1).every(file => file.omittedReason?.includes('total read budget'))
    ).toBe(true);
  });

  it('prunes ignored subtrees before opening them and retains entry limit diagnostics', async () => {
    write('ignored/sub/file');
    write('kept');
    const result = await scanDirectory(root, ['ignored/'], { budgets: { maxEntries: 2 } });
    expect(result.files.map(file => file.newPath)).toEqual(['kept']);
    expect(vi.mocked(opendir).mock.calls.map(([path]) => path)).toEqual([root]);
    const over = await scanDirectory(root, [], { budgets: { maxEntries: 1 } });
    expect(over.files).toEqual([]);
    expect(over.entryLimitExceeded).toBe(true);
    expect(over.diagnostics[0]).toContain('more than 1');
  });

  it('refuses an ancestor exchanged during async open and closes the acquired handle', async () => {
    write('sub/a', 'inside');
    mkdirSync(join(root, 'outside'));
    write('outside/a', 'SECRET');
    let close: ReturnType<typeof vi.spyOn> | undefined;
    vi.mocked(open).mockImplementationOnce(async (...args) => {
      renameSync(join(root, 'sub'), join(root, 'saved'));
      symlinkSync(join(root, 'outside'), join(root, 'sub'));
      const handle = await actual.open(...args);
      close = vi.spyOn(handle, 'close');
      return handle;
    });
    const result = await loadSyntheticFilesAsync(['sub/a'], root);
    expect(result.files).toEqual([]);
    expect(result.diagnostics.join(' ')).toContain('unsafe-link');
    expect(JSON.stringify(result)).not.toContain('SECRET');
    expect(close).toHaveBeenCalledTimes(1);
  });

  it.each(['per-file', 'total'])(
    'refuses growth beyond the %s budget during reading',
    async budget => {
      write('growing', 'x'.repeat(16 * 1024));
      observeReads((_name, count) => {
        if (count === 1) appendFileSync(join(root, 'growing'), 'y'.repeat(32 * 1024));
      });
      const result = await loadSyntheticFilesAsync(['growing'], root, {
        budgets: budget === 'per-file' ? { maxFileBytes: 20 * 1024 } : { maxTotalBytes: 20 * 1024 },
      });
      expect(result.files[0].hunks).toEqual([]);
      expect(result.files[0].omittedReason).toContain(`${budget} read budget`);
    }
  );

  it('counts partial reads on an I/O failure against the aggregate budget', async () => {
    write('a', 'x'.repeat(20 * 1024));
    write('b', 'y'.repeat(7000));
    write('c');
    const readNames: string[] = [];
    vi.mocked(open).mockImplementation(async (...args) => {
      const handle = await actual.open(...args);
      const read = handle.read.bind(handle);
      let calls = 0;
      vi.spyOn(handle as Pick<AsyncFileHandle, 'read'>, 'read').mockImplementation(
        async (buffer, offset, length, position) => {
          readNames.push(basename(String(args[0])));
          if (basename(String(args[0])) === 'a') {
            if (++calls === 2) throw Object.assign(new Error('failed'), { code: 'EIO' });
            return read(buffer, offset, 4096, position);
          }
          return read(buffer, offset, length, position);
        }
      );
      return handle;
    });
    const result = await loadSyntheticFilesAsync(['a', 'b', 'c'], root, {
      budgets: { maxTotalBytes: 10000 },
    });
    expect(readNames).toEqual(['a', 'a']);
    expect(result.files.map(file => file.newPath)).toEqual(['b', 'c']);
    expect(result.files.every(file => file.omittedReason?.includes('total read budget'))).toBe(
      true
    );
    expect(result.diagnostics.join(' ')).toContain('a (EIO)');
  });

  it('never reads special files, including an explicitly named FIFO', async () => {
    execFileSync('mkfifo', [join(root, 'pipe')]);
    const observed = observeReads(() => {});
    expect(await readSyntheticSourceAsync(join(root, 'pipe'))).toEqual({
      kind: 'skip',
      bytesRead: 0,
    });
    expect(await readSyntheticSourceAsync(join(root, 'pipe'), { followSymlinks: true })).toEqual({
      kind: 'skip',
      bytesRead: 0,
    });
    expect(observed.reads).toEqual([]);
    expect(observed.closes).toHaveLength(2);
    for (const close of observed.closes) expect(close).toHaveBeenCalledTimes(1);
  });

  it('reports I/O failures and closes the failed handle rather than returning an empty success', async () => {
    write('bad');
    let closed: ReturnType<typeof vi.spyOn> | undefined;
    vi.mocked(open).mockImplementationOnce(async (...args) => {
      const handle = await actual.open(...args);
      closed = vi.spyOn(handle, 'close');
      vi.spyOn(handle, 'read').mockRejectedValue(
        Object.assign(new Error('read failed'), { code: 'EIO' })
      );
      return handle;
    });
    const result = await loadSyntheticFilesAsync(['bad'], root);
    expect(result.files).toEqual([]);
    expect(result.diagnostics.join(' ')).toContain('bad (EIO)');
    expect(closed).toHaveBeenCalledTimes(1);
  });
});
