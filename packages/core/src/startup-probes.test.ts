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
