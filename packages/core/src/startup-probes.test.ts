import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { resolveStartupSource, resolveStartupSourceAsync } from './startup-mode';
import { getGitDiffStats, getGitDiffStatsResult } from './payload-sizing';
import { CommandCancelledError, type ForgeCommandRunner } from './forge-provider';
import { GitCommandError, type GitExecutionOptions } from './index';
import { gitSync } from './test-support/git-env';

let root: string;
beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'self-review-startup-probes-'));
});
afterEach(() => {
  vi.unstubAllEnvs();
  rmSync(root, { recursive: true, force: true });
});

const ok: ForgeCommandRunner = async () => ({ stdout: '', stderr: '', exitCode: 0 });

describe('bounded asynchronous startup probes', () => {
  it('uses the classifier and forwards each command lifetime', async () => {
    const controller = new AbortController();
    const runner = vi.fn(ok);
    await expect(
      resolveStartupSourceAsync(['-S', 'not-a-source'], root, {
        runner,
        signal: controller.signal,
        timeoutMs: 321,
      })
    ).resolves.toEqual({ mode: 'git' });
    expect(runner).toHaveBeenCalledExactlyOnceWith('git', ['rev-parse', '--git-dir'], {
      cwd: root,
      signal: controller.signal,
      timeoutMs: 321,
      maxOutputBytes: 1024 * 1024,
    });
  });

  it('keeps literal file pathspecs and the file fallback on an ordinary probe failure', async () => {
    writeFileSync(join(root, 'file with spaces'), 'text');
    const runner = vi
      .fn<ForgeCommandRunner>()
      .mockResolvedValueOnce({ stdout: '.git', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: '', stderr: 'untracked', exitCode: 1 });
    await expect(
      resolveStartupSourceAsync(['--', 'file with spaces'], root, { runner })
    ).resolves.toEqual({ mode: 'file', sourcePath: join(root, 'file with spaces') });
    expect(runner.mock.calls[1][1]).toEqual([
      'ls-files',
      '--error-unmatch',
      '--',
      'file with spaces',
    ]);
  });

  it('matches synchronous file, directory and welcome fallbacks without git', async () => {
    writeFileSync(join(root, 'note.txt'), 'text');
    const runner: ForgeCommandRunner = async () => {
      throw new Error('ENOENT');
    };
    for (const args of [[], ['.'], ['note.txt'], ['missing']]) {
      expect(await resolveStartupSourceAsync(args, root, { runner })).toEqual(
        resolveStartupSource(args, root)
      );
    }
  });

  it.each(['aborted', 'timeout'] as const)(
    'propagates %s rather than selecting welcome',
    async reason => {
      const error = new CommandCancelledError(reason, 'git', []);
      const runner: ForgeCommandRunner = async () => {
        throw error;
      };
      await expect(resolveStartupSourceAsync([], root, { runner })).rejects.toBe(error);
    }
  );

  it('does not start a command for an already aborted caller', async () => {
    const runner = vi.fn(ok);
    const controller = new AbortController();
    controller.abort();
    await expect(
      resolveStartupSourceAsync([], root, { runner, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
    expect(runner).not.toHaveBeenCalled();
  });
});

describe('git statistics results', () => {
  it('distinguishes empty output from a completed failure', async () => {
    expect(await getGitDiffStatsResult([], root, { runner: ok })).toEqual({
      available: true,
      stats: { fileCount: 0, totalLines: 0 },
    });
    const options: GitExecutionOptions = {
      runner: async () => ({ stdout: '', stderr: 'bad revision', exitCode: 128 }),
    };
    const result = await getGitDiffStatsResult([], root, options);
    expect(result.available).toBe(false);
    if (!result.available) expect(result.error).toBeInstanceOf(GitCommandError);
  });

  it('forwards the output bound and caller deadline to the shared runner', async () => {
    const runner = vi.fn(ok);
    const controller = new AbortController();
    await getGitDiffStatsResult(['--cached'], root, {
      runner,
      signal: controller.signal,
      timeoutMs: 99,
    });
    expect(runner).toHaveBeenCalledExactlyOnceWith('git', ['diff', '--numstat', '--cached'], {
      cwd: root,
      signal: controller.signal,
      timeoutMs: 99,
      maxOutputBytes: 10 * 1024 * 1024,
    });
  });

  it.each(['aborted', 'timeout'] as const)(
    'never reports %s as available zero statistics',
    async reason => {
      const error = new CommandCancelledError(reason, 'git', []);
      const runner: ForgeCommandRunner = async () => {
        throw error;
      };
      await expect(getGitDiffStatsResult([], root, { runner })).rejects.toBe(error);
      await expect(getGitDiffStats([], root, { runner, timeoutMs: 99 })).rejects.toBe(error);
    }
  );
});

describe('explicit repository environment', () => {
  it('makes sync/async startup and stats agree despite ambient repository selection', async () => {
    gitSync(['init', '-q', root]);
    writeFileSync(join(root, 'tracked.txt'), 'first\nsecond\n');
    gitSync(['add', 'tracked.txt'], { cwd: root });
    vi.stubEnv('GIT_DIR', join(root, 'missing.git'));
    vi.stubEnv('GIT_COMMON_DIR', join(root, 'missing.git'));
    vi.stubEnv('GIT_WORK_TREE', join(root, 'missing'));
    vi.stubEnv('GIT_PREFIX', 'wrong/');
    expect(resolveStartupSource(['tracked.txt'], root)).toEqual({ mode: 'git' });
    expect(await resolveStartupSourceAsync(['tracked.txt'], root)).toEqual({ mode: 'git' });
    expect(await getGitDiffStatsResult(['--cached'], root)).toEqual({
      available: true,
      stats: { fileCount: 1, totalLines: 2 },
    });
  });

  it('preserves a deliberately selected alternate local index for every probe', async () => {
    gitSync(['init', '-q', root]);
    writeFileSync(join(root, 'tracked.txt'), 'text\n');
    gitSync(['add', 'tracked.txt'], { cwd: root });
    vi.stubEnv('GIT_INDEX_FILE', join(root, 'alternate-index'));
    expect(resolveStartupSource(['tracked.txt'], root).mode).toBe('file');
    expect((await resolveStartupSourceAsync(['tracked.txt'], root)).mode).toBe('file');
    expect(await getGitDiffStatsResult(['--cached'], root)).toEqual({
      available: true,
      stats: { fileCount: 0, totalLines: 0 },
    });
  });
});

describe('authoritative startup path probes', () => {
  const unavailable: ForgeCommandRunner = async () => ({ stdout: '', stderr: '', exitCode: 1 });
  const file = { isFile: () => true, isDirectory: () => false };
  const directory = { isFile: () => false, isDirectory: () => true };

  it.each([
    ['virtual.txt', file, 'file'],
    ['virtual-dir', directory, 'directory'],
  ] as const)('classifies %s without physical paths', async (name, metadata, mode) => {
    const sourceProbe = {
      metadata,
      async stat(candidate: string) {
        expect(candidate).toBe(join(root, name));
        return this.metadata;
      },
    };
    const options = { runner: unavailable, sourceProbe };
    await expect(resolveStartupSourceAsync([name], root, options)).resolves.toEqual({
      mode,
      sourcePath: join(root, name),
    });
  });

  it.each(['null', 'throw'] as const)(
    'honors a supplied %s refusal over a physical file',
    async refusal => {
      writeFileSync(join(root, 'physical.txt'), 'text');
      const stat = vi.fn(async () => {
        if (refusal === 'throw') throw new Error('provider refused');
        return null;
      });
      const options = { runner: unavailable, sourceProbe: { stat } };
      await expect(resolveStartupSourceAsync(['physical.txt'], root, options)).resolves.toEqual({
        mode: 'welcome',
      });
      expect(stat).toHaveBeenCalledExactlyOnceWith(join(root, 'physical.txt'));
    }
  );

  it.each([
    ['file', file, true, true, 'git'],
    ['untracked', file, true, false, 'file'],
    ['directory', directory, true, false, 'git'],
    ['directory', directory, false, false, 'directory'],
    ['missing', null, true, false, 'git'],
  ] as const)('keeps %s mode precedence', async (name, stats, repository, tracked, mode) => {
    const runner = vi.fn<ForgeCommandRunner>(async (_command, args) => ({
      stdout: '',
      stderr: '',
      exitCode: (args[0] === 'rev-parse' ? repository : tracked) ? 0 : 1,
    }));
    const options = { runner, sourceProbe: { stat: vi.fn(async () => stats) } };
    const result = await resolveStartupSourceAsync(['--', name], root, options);
    expect(result).toEqual(mode === 'git' ? { mode } : { mode, sourcePath: join(root, name) });
    expect(runner.mock.calls.every(([, , options]) => options?.cwd === root)).toBe(true);
    expect(runner.mock.calls.map(([, args]) => args)).toEqual([
      ['rev-parse', '--git-dir'],
      ...(stats === file && repository ? [['ls-files', '--error-unmatch', '--', name]] : []),
    ]);
  });

  it('does not probe option values or absent positionals', async () => {
    const stat = vi.fn(async () => file);
    for (const args of [[], ['-S', 'virtual.txt'], ['--staged']]) {
      const options = { runner: unavailable, sourceProbe: { stat } };
      expect(await resolveStartupSourceAsync(args, root, options)).toEqual({ mode: 'welcome' });
    }
    expect(stat).not.toHaveBeenCalled();
  });

  it('checks cancellation before starting any path or git probe', async () => {
    const controller = new AbortController();
    controller.abort();
    const stat = vi.fn(async () => file);
    const runner = vi.fn(ok);
    const options = { runner, signal: controller.signal, sourceProbe: { stat } };
    await expect(resolveStartupSourceAsync(['virtual'], root, options)).rejects.toMatchObject({
      name: 'CommandCancelledError',
      reason: 'aborted',
    });
    expect(stat).not.toHaveBeenCalled();
    expect(runner).not.toHaveBeenCalled();
  });

  it.each(['resolve', 'reject'] as const)(
    'joins a pending provider %s before propagating cancellation',
    async outcome => {
      const controller = new AbortController();
      let settle!: () => void;
      let entered!: () => void;
      const started = new Promise<void>(resolve => {
        entered = resolve;
      });
      const stat = vi.fn(
        () =>
          new Promise<typeof file>((resolve, reject) => {
            settle = () =>
              outcome === 'resolve' ? resolve(file) : reject(new Error('probe failed'));
            entered();
          })
      );
      const runner = vi.fn(ok);
      const options = { runner, signal: controller.signal, sourceProbe: { stat } };
      const result = resolveStartupSourceAsync(['virtual'], root, options);
      let settled = false;
      const observed = result.then(
        value => {
          settled = true;
          return { value };
        },
        error => {
          settled = true;
          return { error };
        }
      );
      await Promise.race([started, observed]);
      expect(stat).toHaveBeenCalledOnce();
      controller.abort();
      await Promise.resolve();
      expect(settled).toBe(false);
      settle();
      expect(await observed).toMatchObject({
        error: { name: 'CommandCancelledError', reason: 'aborted' },
      });
      expect(runner).not.toHaveBeenCalled();
    }
  );

  it('propagates typed provider cancellation without an aborted signal', async () => {
    const error = new CommandCancelledError('timeout', 'probe', []);
    const options = {
      runner: unavailable,
      sourceProbe: {
        stat: async () => {
          throw error;
        },
      },
    };
    await expect(resolveStartupSourceAsync(['virtual'], root, options)).rejects.toBe(error);
  });

  it('propagates cancellation if a git provider rejects an ordinary failure after abort', async () => {
    const controller = new AbortController();
    const runner: ForgeCommandRunner = async () => {
      controller.abort();
      throw new Error('ordinary failure after abort');
    };
    await expect(
      resolveStartupSourceAsync([], root, { runner, signal: controller.signal })
    ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
  });
});
