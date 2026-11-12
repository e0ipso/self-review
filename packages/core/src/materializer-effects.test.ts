import { afterEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'node:fs';
import { setImmediate } from 'node:timers/promises';
import { materialize } from './materializer';
import { nodeTemporaryCloneStorage } from './remote-temp';
import type { TemporaryCloneStorage } from './materializer';
import { CommandCancelledError } from './forge-provider';
import type { ForgeCommandRunner, ForgeUrl } from './forge-provider';
import { startRemoteSession } from './remote-mode';

const url: ForgeUrl = {
  forge: 'github',
  host: 'github.com',
  owner: 'owner',
  repo: 'repo',
  number: 1,
};
const ok = (stdout = '') => ({ stdout, stderr: '', exitCode: 0 });
const runner: ForgeCommandRunner = async (_command, args) =>
  ok(args.includes('rev-parse') ? 'a'.repeat(40) : '');
const dirs: string[] = [];
const releases: Array<() => Promise<void>> = [];
afterEach(async () => {
  for (const release of releases.splice(0)) await release();
  for (const dir of dirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});
const virtualStorage = (): TemporaryCloneStorage => ({
  create: vi.fn(async () => '/__owned_virtual_clone__'),
  remove: vi.fn(async () => {}),
  removeSync: vi.fn(() => {}),
});
async function create(
  storage: TemporaryCloneStorage,
  commandRunner = runner,
  signal?: AbortSignal
) {
  const result = await materialize(url, 'main', '/cwd', commandRunner, null, {
    temporaryClones: storage,
    signal,
    reportDiagnostic: () => {},
  });
  releases.push(result.cleanup);
  return result;
}

describe('temporary clone effects', () => {
  it('removes real clones asynchronously while timers can run and joins concurrent disposal', async () => {
    let timerRan = false;
    let observedTimer = false;
    const storage = {
      ...nodeTemporaryCloneStorage,
      async create() {
        const dir = await nodeTemporaryCloneStorage.create();
        dirs.push(dir);
        for (let i = 0; i < 100; i++) fs.writeFileSync(`${dir}/file-${i}`, 'owned');
        return dir;
      },
      remove: vi.fn(async (dir: string) => {
        await nodeTemporaryCloneStorage.remove(dir);
        observedTimer = timerRan;
      }),
      removeSync: vi.fn(nodeTemporaryCloneStorage.removeSync),
    };
    const result = await create(storage);
    const timer = setTimeout(() => {
      timerRan = true;
    }, 0);
    const first = result.cleanupAsync!();
    expect(result.cleanupAsync!()).toBe(first);
    await first;
    clearTimeout(timer);
    expect(observedTimer).toBe(true);
    expect(fs.existsSync(result.repoPath)).toBe(false);
    await result.cleanupAsync!();
    await result.cleanup();
    expect(storage.remove).toHaveBeenCalledOnce();
    expect(storage.removeSync).not.toHaveBeenCalled();
  });

  it('retains synchronous-first exit removal before a promise can be awaited', async () => {
    const storage = virtualStorage();
    const result = await create(storage);
    const done = result.cleanup();
    expect(storage.removeSync).toHaveBeenCalledExactlyOnceWith('/__owned_virtual_clone__');
    expect(storage.remove).not.toHaveBeenCalled();
    await done;
    await result.cleanupAsync!();
    expect(storage.remove).not.toHaveBeenCalled();
  });

  it('retries failed asynchronous removal, preserves reporter isolation and coalesces both call forms', async () => {
    const storage = virtualStorage();
    const remove = vi.mocked(storage.remove);
    remove.mockRejectedValueOnce(new Error('busy'));
    const reportDiagnostic = vi.fn(() => {
      throw new Error('report failed');
    });
    const result = await materialize(url, 'main', '/cwd', runner, null, {
      temporaryClones: storage,
      reportDiagnostic,
    });
    const first = result.cleanupAsync!();
    expect(result.cleanupAsync!()).toBe(first);
    expect(result.cleanup()).toBe(first);
    await expect(first).resolves.toBeUndefined();
    expect(storage.removeSync).not.toHaveBeenCalled();
    expect(reportDiagnostic).toHaveBeenCalledWith(expect.stringContaining('could not remove'));
    await result.cleanupAsync!();
    await result.cleanupAsync!();
    expect(remove).toHaveBeenCalledTimes(2);
  });

  it.each(['clone', 'fetch', 'rev-parse', 'cancel'] as const)(
    'releases virtual ownership after %s failure without host fallback',
    async stage => {
      const storage = virtualStorage();
      const controller = new AbortController();
      const broken: ForgeCommandRunner = async (command, args, options) => {
        if (stage === 'cancel' && args.includes('clone')) controller.abort();
        if (args.includes(stage)) throw new Error(stage);
        return runner(command, args, options);
      };
      await expect(create(storage, broken, controller.signal)).rejects.toThrow();
      expect(storage.create).toHaveBeenCalledOnce();
      expect(storage.remove).toHaveBeenCalledExactlyOnceWith('/__owned_virtual_clone__');
      expect(storage.removeSync).not.toHaveBeenCalled();
    }
  );

  it('normalizes asynchronous disposal into remote sessions, retaining an exit fallback', async () => {
    const storage = virtualStorage();
    const result = await startRemoteSession(
      'https://github.com/owner/repo/pull/1',
      '/cwd',
      {
        runner,
        detectExistingClone: async () => null,
        createProvider: () => ({
          forge: 'github',
          fetchBaseBranch: async () => 'main',
          fetchThreads: async () => [],
        }),
      },
      {
        temporaryClones: storage,
        reportDiagnostic() {
          throw new Error('report failed');
        },
      }
    );
    await result.cleanup();
    expect(storage.remove).toHaveBeenCalledOnce();
    expect(storage.removeSync).not.toHaveBeenCalled();
    await result.cleanupForExit!();
    expect(storage.removeSync).not.toHaveBeenCalled();
  });

  it('removes a clone before a cancelled thread fetch rejects despite a throwing reporter', async () => {
    const storage = virtualStorage();
    await expect(
      startRemoteSession(
        'https://github.com/owner/repo/pull/1',
        '/cwd',
        {
          runner,
          detectExistingClone: async () => null,
          createProvider: () => ({
            forge: 'github',
            fetchBaseBranch: async () => 'main',
            fetchThreads: async () => {
              await setImmediate();
              throw new CommandCancelledError('aborted', 'gh', []);
            },
          }),
        },
        {
          temporaryClones: storage,
          reportDiagnostic() {
            throw new Error('report failed');
          },
        }
      )
    ).rejects.toBeInstanceOf(CommandCancelledError);
    expect(storage.remove).toHaveBeenCalledOnce();
  });
});

it('uses nonblocking removal on the default first-party remote lifetime', async () => {
  let owned = '';
  const session = await startRemoteSession(
    'https://github.com/owner/repo/pull/1',
    '/cwd',
    {
      detectExistingClone: async () => null,
      createProvider: () => ({
        forge: 'github',
        fetchBaseBranch: async () => 'main',
        fetchThreads: async () => [],
      }),
      runner: async (command, args, options) => {
        if (args[0] === 'clone') {
          owned = args.at(-1)!;
          dirs.push(owned);
          for (let i = 0; i < 100; i++) fs.writeFileSync(`${owned}/file-${i}`, 'owned');
        }
        return runner(command, args, options);
      },
    },
    { reportDiagnostic: () => {} }
  );
  releases.push(session.cleanup);
  let timerRan = false;
  const timer = setTimeout(() => {
    timerRan = true;
  }, 0);
  await session.cleanup();
  clearTimeout(timer);
  expect(fs.existsSync(owned)).toBe(false);
  expect(timerRan).toBe(true);
});
