import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { gitSync } from './test-support/git-env';
import { loadGitDiffWithUntracked } from './git-diff-loader';
import { createReviewSession, commitDiffData, loadImage } from './review-handlers';
import { createIgnoreFilter } from './ignore-filter';
import { loadLocalReview } from './startup';
import { DEFAULT_CONFIG } from '../../react/src/config-defaults';
import { defaultGitRunner } from './command-runner';
import * as commandRunner from './command-runner';
import { defaultRemoteSessionDeps } from './remote-mode';
import type { ForgeCommandRunner } from './forge-provider';
import { CommandCancelledError } from './forge-provider';

let root: string;
const png = Buffer.from([137, 80, 78, 71, 0, 1, 2]);
const git = (...args: string[]) => gitSync(args, { cwd: root }).trim();
beforeEach(() => {
  root = realpathSync(mkdtempSync(join(tmpdir(), 'sr-loading-contract-')));
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 'test@example.com');
  git('config', 'user.name', 'Test');
  mkdirSync(join(root, 'sub'));
  writeFileSync(join(root, 'sub', 'tracked.txt'), 'original\n');
  git('add', 'sub/tracked.txt');
  git('commit', '-qm', 'initial');
});
afterEach(() => {
  vi.restoreAllMocks();
  rmSync(root, { recursive: true, force: true });
});

async function preview(argv: string[], cwd: string, path: string) {
  const loaded = await loadGitDiffWithUntracked(argv, cwd);
  const session = createReviewSession();
  commitDiffData(
    session,
    { files: loaded.files, source: { type: 'git', gitDiffArgs: argv.join(' '), repository: root } },
    loaded.identity
  );
  return { loaded, image: await loadImage(session, path) };
}

describe('synthetic sources in git comparisons', () => {
  it.each([
    ['explicit', ['--relative=sub'], ''],
    ['launch directory', ['--relative'], 'sub'],
  ])('uses one path namespace with %s relativity', async (_label, argv, from) => {
    writeFileSync(join(root, 'sub', 'picture.png'), png);
    mkdirSync(join(root, 'sub', 'sub'));
    writeFileSync(join(root, 'sub', 'sub', 'picture.png'), Buffer.from([0, 9, 9]));
    writeFileSync(join(root, 'picture.png'), Buffer.from([0, 8, 8]));
    writeFileSync(join(root, 'tracked.txt'), 'unrelated root file\n');
    writeFileSync(join(root, 'sub', 'tracked.txt'), 'changed\n');
    const { loaded, image } = await preview(argv, join(root, from), 'picture.png');
    expect(loaded.files.map(file => file.newPath)).toEqual([
      'tracked.txt',
      'picture.png',
      'sub/picture.png',
    ]);
    expect(loaded.files.find(file => file.newPath === 'tracked.txt')?.isUntracked).toBeUndefined();
    expect(image).toEqual({ dataUri: `data:image/png;base64,${png.toString('base64')}` });
  });

  it('reads a synthetic untracked image from the working tree in a staged review', async () => {
    writeFileSync(join(root, 'sub', 'picture.png'), png);
    const { image } = await preview(['--cached'], root, 'sub/picture.png');
    expect(image).toEqual({ dataUri: `data:image/png;base64,${png.toString('base64')}` });
  });

  it('does not substitute historical bytes for a synthetic untracked file in a commit range', async () => {
    const first = git('rev-parse', 'HEAD');
    writeFileSync(join(root, 'sub', 'picture.png'), Buffer.from([0, 7, 7]));
    git('add', 'sub/picture.png');
    git('commit', '-qm', 'historical picture');
    const historical = git('rev-parse', 'HEAD');
    git('rm', '-q', 'sub/picture.png');
    git('commit', '-qm', 'remove picture');
    writeFileSync(join(root, 'sub', 'picture.png'), png);
    // The path is unchanged between these two historical commits but exists there.
    const { loaded, image } = await preview([historical, historical], root, 'sub/picture.png');
    expect(first).not.toBe(historical);
    expect(loaded.files[0].isUntracked).toBe(true);
    expect(image).toEqual({ dataUri: `data:image/png;base64,${png.toString('base64')}` });
  });

  it('filters ignored generated files before entry and read budgets', async () => {
    mkdirSync(join(root, 'generated'));
    for (let i = 0; i < 5; i++) writeFileSync(join(root, 'generated', `${i}.txt`), 'x'.repeat(200));
    writeFileSync(join(root, 'wanted.txt'), 'wanted\n');
    const loaded = await loadGitDiffWithUntracked([], root, {
      shouldKeep: createIgnoreFilter(['generated/']),
      budgets: { maxEntries: 1, maxTotalBytes: 7, maxFileBytes: 7 },
    });
    expect(loaded.files.map(file => file.newPath)).toEqual(['wanted.txt']);
    expect(loaded.files[0].hunks[0].lines[0].content).toBe('wanted');
    expect(loaded.diagnostics).toEqual([]);
  });

  it('passes application ignore rules into git startup before reading synthetic files', async () => {
    mkdirSync(join(root, 'generated'));
    writeFileSync(join(root, 'generated', 'large.txt'), 'x'.repeat(5 * 1024 * 1024 + 1));
    writeFileSync(join(root, 'wanted.txt'), 'wanted\n');
    const result = await loadLocalReview(
      { mode: 'git' },
      [],
      { ...DEFAULT_CONFIG, ignore: ['generated/'] },
      root,
      () => {}
    );
    expect(result.payload.files.map(file => file.newPath)).toEqual(['wanted.txt']);
    expect(result.payload.diagnostics).toBeUndefined();
  });
});

describe('bounded command failures and cancellation', () => {
  it.each(['failure', 'timeout', 'output limit'])(
    'retains tracked work with a diagnostic on enumeration %s',
    async kind => {
      writeFileSync(join(root, 'sub', 'tracked.txt'), 'changed\n');
      const runner: ForgeCommandRunner = (command, args, options) => {
        if (args[0] === 'ls-files') {
          if (kind === 'failure')
            return Promise.resolve({ stdout: '', stderr: 'listing failed', exitCode: 128 });
          if (kind === 'timeout')
            return Promise.reject(new CommandCancelledError('timeout', command, args));
          return Promise.reject(
            Object.assign(new Error('listing exceeded its capture limit'), {
              code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER',
            })
          );
        }
        return defaultGitRunner(command, args, options);
      };
      const loaded = await loadGitDiffWithUntracked([], root, { runner });
      expect(loaded.files.map(file => file.newPath)).toEqual(['sub/tracked.txt']);
      expect(loaded.diagnostics).toHaveLength(1);
      expect(loaded.diagnostics[0]).toContain('Untracked files could not be listed');
    }
  );

  it('rejects an already cancelled real load instead of publishing a completed review', async () => {
    await expect(
      loadGitDiffWithUntracked(['HEAD'], root, { signal: AbortSignal.abort() })
    ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
  });

  it("kills and awaits the remote default loader's running diff child on cancellation", async () => {
    const controller = new AbortController();
    const marker = join(root, 'child.pid');
    const realRunner = defaultGitRunner;
    let receivedSignal: AbortSignal | undefined;
    vi.spyOn(commandRunner, 'defaultGitRunner').mockImplementation((command, args, options) => {
      if (!args.includes('diff')) return realRunner(command, args, options);
      receivedSignal = options?.signal;
      return realRunner(
        process.execPath,
        [
          '-e',
          `require('fs').writeFileSync(${JSON.stringify(marker)}, String(process.pid)); setInterval(() => {}, 1000);`,
        ],
        {
          ...options,
          // Own teardown even if forwarding regresses; assert the received signal below.
          signal: options?.signal ?? controller.signal,
        }
      );
    });
    const loading = defaultRemoteSessionDeps
      .loadDiff(['HEAD'], root, { signal: controller.signal })
      .catch(error => error);
    try {
      await vi.waitFor(() => expect(existsSync(marker)).toBe(true));
    } finally {
      controller.abort();
    }
    expect(await loading).toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
    expect(receivedSignal).toBe(controller.signal);
    const pid = Number(readFileSync(marker, 'utf-8'));
    expect(() => process.kill(pid, 0)).toThrow();
  });
});
