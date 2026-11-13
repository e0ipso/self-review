import { afterEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { defaultGitRunner, runBufferedCommand } from './command-runner';
import { gitSync } from './test-support/git-env';
import { getRepoRootAsync } from './git';
import { readReviewedContent } from './snapshot-reader';
import { resolveLocalSourceIdentity, resolveGitSourceIdentity } from './source-identity';
import { execFileSync } from 'child_process';
import type { ForgeCommandOptions } from './forge-provider';

const directories: string[] = [];
function directory() {
  const dir = realpathSync(mkdtempSync(join(tmpdir(), 'sr-command-')));
  directories.push(dir);
  return dir;
}
afterEach(() => {
  vi.unstubAllEnvs();
  for (const dir of directories.splice(0)) rmSync(dir, { recursive: true, force: true });
});

// Both adapters expose identical exit, bounds and cancellation behavior.
describe.each([
  { name: 'text', run: defaultGitRunner },
  { name: 'binary', run: runBufferedCommand },
])('$name command contract', ({ run }) => {
  it('captures UTF-8 text without a shell and honors cwd', async () => {
    const cwd = directory();
    const result = await run(
      process.execPath,
      [
        '-e',
        'process.stdout.write(process.argv[1]);process.stderr.write(process.cwd());process.exitCode=3;',
        'café $literal',
      ],
      { cwd }
    );
    expect(result.stdout.toString()).toBe('café $literal');
    expect(result.stderr.toString()).toBe(cwd);
    expect(result.exitCode).toBe(3);
  });
  it('rejects a missing binary and an already aborted command', async () => {
    await expect(run('sr-no-such-command-' + process.pid, [])).rejects.toMatchObject({
      code: 'ENOENT',
    });
    await expect(
      run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { signal: AbortSignal.abort() })
    ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
  });
  it('kills commands on timeout and output overflow', async () => {
    await expect(
      run(process.execPath, ['-e', 'setInterval(()=>{},1000)'], { timeoutMs: 50 })
    ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'timeout' });
    await expect(
      run(
        process.execPath,
        ['-e', 'process.stdout.write("a".repeat(40));process.stderr.write("b".repeat(40));'],
        { maxOutputBytes: 64 }
      )
    ).rejects.toMatchObject({ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' });
  });
  it.each([{ maxOutputBytes: -1 }, { maxOutputBytes: Infinity }, { timeoutMs: NaN }])(
    'rejects invalid bounds %j before spawning',
    async (options: ForgeCommandOptions) => {
      await expect(run('sr-no-such-command-' + process.pid, [], options)).rejects.toBeInstanceOf(
        RangeError
      );
    }
  );
});

it('preserves arbitrary binary stdout and stderr bytes', async () => {
  const result = await runBufferedCommand(process.execPath, [
    '-e',
    'const b=Buffer.from([0,255,128,10]);process.stdout.write(b);process.stderr.write(b);',
  ]);
  expect(result.stdout).toEqual(Buffer.from([0, 255, 128, 10]));
  expect(result.stderr).toEqual(result.stdout);
});

it('honors an explicit source root inside a git hook without discarding the selected index', async () => {
  const outer = directory();
  const target = directory();
  gitSync(['init', '-q', outer]);
  gitSync(['init', '-q', target]);
  vi.stubEnv('GIT_DIR', join(outer, '.git'));
  vi.stubEnv('GIT_WORK_TREE', outer);
  expect(await getRepoRootAsync(target)).toBe(target);
  writeFileSync(join(target, 'selected.txt'), 'index selection\n');
  vi.stubEnv('GIT_INDEX_FILE', join(target, '.git', 'alternate-index'));
  await defaultGitRunner('git', ['add', 'selected.txt'], { cwd: target });
  const selected = await defaultGitRunner('git', ['ls-files'], { cwd: target });
  expect(selected.stdout).toBe('selected.txt\n');
  expect(gitSync(['ls-files'], { cwd: target })).toBe('');
});

it('propagates cancellation from identity resolution rather than returning unknown sides', async () => {
  await expect(
    resolveGitSourceIdentity({
      repository: directory(),
      gitDiffArgv: ['HEAD'],
      signal: AbortSignal.abort(),
    })
  ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
});

it('honors snapshot cancellation for physical files as well as git blobs', async () => {
  const root = directory();
  writeFileSync(join(root, 'note.txt'), 'content\n');
  const source = {
    sourceIdentity: resolveLocalSourceIdentity({ type: 'directory', sourcePath: root }),
    reviewedPaths: new Set(['note.txt']),
  };
  await expect(
    readReviewedContent(source, 'note.txt', 'new', { signal: AbortSignal.abort() })
  ).rejects.toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
});

// Both transports must wait for helpers, even if their parent exits on TERM and
// the helper ignores TERM or has closed the inherited pipes.
describe.each([
  { name: 'text', run: defaultGitRunner },
  { name: 'binary', run: runBufferedCommand },
])('$name descendant lifetime', ({ run }) => {
  it('settles an abort after the direct command exits with inherited pipes still open', async () => {
    const root = directory();
    const marker = join(root, 'orphan.json');
    const helper = `require('fs').writeFileSync(process.argv[1],JSON.stringify({pid:process.pid,parent:process.ppid}));setInterval(()=>{},1000);`;
    const parent = `require('child_process').spawn(process.execPath,['-e',${JSON.stringify(helper)},process.argv[1]],{stdio:'inherit'});setInterval(()=>{if(require('fs').existsSync(process.argv[1]))process.exit(0)},10);`;
    const controller = new AbortController();
    let result: unknown;
    const observed = run(process.execPath, ['-e', parent, marker], {
      signal: controller.signal,
    }).catch(error => {
      result = error;
    });
    let helperPid: number | undefined;
    const alive = (pid: number) => {
      try {
        const state = execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], {
          encoding: 'utf8',
        }).trim();
        return state !== '' && !state.startsWith('Z');
      } catch {
        return false;
      }
    };
    try {
      await vi.waitFor(() => {
        const identities = JSON.parse(readFileSync(marker, 'utf8')) as {
          pid: number;
          parent: number;
        };
        helperPid = identities.pid;
        expect(alive(helperPid)).toBe(true);
        expect(alive(identities.parent)).toBe(false);
      });
      controller.abort();
      await vi.waitFor(() => {
        expect(result).toMatchObject({ name: 'CommandCancelledError', reason: 'aborted' });
      });
    } finally {
      controller.abort();
      // The helper has been reparented; only this test's marker authorizes its cleanup.
      if (helperPid !== undefined && alive(helperPid)) process.kill(helperPid, 'SIGKILL');
      await observed;
    }
  });

  it.each(['abort', 'timeout', 'overflow'])(
    'terminates a persistent credential helper on %s',
    async reason => {
      const root = directory();
      const marker = join(root, 'helper.pid');
      const helper = `process.on('SIGTERM',()=>{});require('fs').writeFileSync(process.argv[1],String(process.pid));setInterval(()=>{},1000);`;
      const parent = `const {spawn}=require('child_process');spawn(process.execPath,['-e',${JSON.stringify(helper)},process.argv[1]],{stdio:${JSON.stringify(reason === 'abort' ? 'inherit' : 'ignore')}});setInterval(()=>{if(require('fs').existsSync(process.argv[1]))process.stdout.write('ready\\n')},10);`;
      const controller = new AbortController();
      const promise = run(process.execPath, ['-e', parent, marker], {
        signal: controller.signal,
        ...(reason === 'timeout' ? { timeoutMs: 1_000 } : {}),
        ...(reason === 'overflow' ? { maxOutputBytes: 12 } : {}),
      });
      const observed = promise.catch(error => error);
      let pid: number | undefined;
      const alive = () => {
        if (pid === undefined) return false;
        try {
          const state = execFileSync('ps', ['-o', 'stat=', '-p', String(pid)], {
            encoding: 'utf8',
          }).trim();
          return state !== '' && !state.startsWith('Z');
        } catch {
          return false;
        }
      };
      try {
        await vi.waitFor(() => {
          pid = Number(readFileSync(marker, 'utf8'));
          expect(alive()).toBe(true);
        });
        if (reason === 'abort') controller.abort();
        const error = await observed;
        expect(error).toMatchObject(
          reason === 'overflow'
            ? { code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER' }
            : { name: 'CommandCancelledError', reason: reason === 'abort' ? 'aborted' : 'timeout' }
        );
        expect(alive()).toBe(false);
      } finally {
        controller.abort();
        // The marker is written by this test's helper; never use a process-name kill.
        if (alive()) process.kill(pid!, 'SIGKILL');
        await observed;
      }
    },
    10_000
  );
});
