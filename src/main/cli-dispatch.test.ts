import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// spawnSync is the only child_process member this module touches, and it must
// never run for real here: the re-exec target is the current binary.
const spawnSync = vi.hoisted(() => vi.fn());
vi.mock('child_process', async importOriginal => {
  const actual = await importOriginal<typeof import('child_process')>();
  return { ...actual, spawnSync };
});

import {
  HEADLESS_GUARD_ENV,
  HEADLESS_OZONE_SWITCH,
  defaultCliDispatchDeps,
  dispatchCli,
  needsHeadlessReexec,
  reexecHeadless,
  type CliDispatchDeps,
} from './cli-dispatch';
import type { CliArgs } from './cli';

function makeArgs(overrides: Partial<CliArgs> = {}): CliArgs {
  return {
    resumeFrom: null,
    gitDiffArgs: [],
    subcommand: null,
    remoteUrl: null,
    allThreads: false,
    ...overrides,
  };
}

function makeDeps(overrides: Partial<CliDispatchDeps> = {}): CliDispatchDeps {
  return {
    earlyExit: vi.fn(() => ({ shouldExit: false, exitCode: 0 })),
    guardBundlePath: vi.fn(),
    parseArgs: vi.fn(() => makeArgs()),
    needsReexec: vi.fn(() => false),
    reexec: vi.fn(),
    fetchComments: vi.fn(async () => {}),
    logError: vi.fn(),
    exit: vi.fn(),
    ...overrides,
  };
}

describe('needsHeadlessReexec', () => {
  it('re-execs a plain Linux launch', () => {
    expect(needsHeadlessReexec('linux', ['electron', '.', 'fetch-comments'], {})).toBe(true);
  });

  it.each(['darwin', 'win32'] as const)('leaves %s alone: Ozone is not its concern', platform => {
    expect(needsHeadlessReexec(platform, ['electron', '.', 'fetch-comments'], {})).toBe(false);
  });

  it('does not re-exec the child it already spawned', () => {
    expect(
      needsHeadlessReexec('linux', ['electron', '.', 'fetch-comments'], {
        [HEADLESS_GUARD_ENV]: '1',
      })
    ).toBe(false);
  });

  it('re-execs when the guard variable holds any other value', () => {
    // Only the exact '1' the re-exec sets counts as the guard.
    expect(needsHeadlessReexec('linux', ['electron', '.'], { [HEADLESS_GUARD_ENV]: '0' })).toBe(
      true
    );
  });

  it.each([
    HEADLESS_OZONE_SWITCH,
    '--ozone-platform=wayland',
    '--ozone-platform-hint=auto',
    '--ozone-platform',
  ])('yields to an explicit %s on the command line', switchArg => {
    expect(needsHeadlessReexec('linux', ['electron', '.', switchArg], {})).toBe(false);
  });

  it('matches the real process through the default dependency', () => {
    expect(defaultCliDispatchDeps.needsReexec()).toBe(
      needsHeadlessReexec(process.platform, process.argv, process.env)
    );
  });
});

describe('reexecHeadless', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let killSpy: ReturnType<typeof vi.spyOn>;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // process.exit must not end the worker; the function's last statement is
    // the exit call, so returning is equivalent to never coming back.
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => undefined) as never);
    killSpy = vi.spyOn(process, 'kill').mockImplementation(() => true);
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    exitSpy.mockRestore();
    killSpy.mockRestore();
    errorSpy.mockRestore();
    spawnSync.mockReset();
  });

  it('prepends the headless switch and keeps the original arguments in order', () => {
    spawnSync.mockReturnValue({ status: 0, signal: null, error: undefined });

    reexecHeadless();

    const [command, argv, options] = spawnSync.mock.calls[0];
    expect(command).toBe(process.execPath);
    expect(argv[0]).toBe(HEADLESS_OZONE_SWITCH);
    expect(argv.slice(1)).toEqual(process.argv.slice(1));
    expect(options.stdio).toBe('inherit');
    expect(options.env[HEADLESS_GUARD_ENV]).toBe('1');
    expect(exitSpy).toHaveBeenCalledWith(0);
  });

  it('forwards the child exit code', () => {
    spawnSync.mockReturnValue({ status: 3, signal: null, error: undefined });
    reexecHeadless();
    expect(exitSpy).toHaveBeenCalledWith(3);
  });

  it('re-raises the signal that killed the child', () => {
    spawnSync.mockReturnValue({ status: null, signal: 'SIGINT', error: undefined });

    reexecHeadless();

    expect(killSpy).toHaveBeenCalledWith(process.pid, 'SIGINT');
    // Falls through to exit for the case where a handler swallowed the signal.
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('explains a spawn failure instead of exiting silently', () => {
    spawnSync.mockReturnValue({ status: null, signal: null, error: new Error('ENOENT') });

    reexecHeadless();

    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('ENOENT'));
    expect(exitSpy).toHaveBeenCalledWith(1);
    expect(killSpy).not.toHaveBeenCalled();
  });
});

describe('dispatchCli', () => {
  it('exits on --help/--version before anything else runs', () => {
    const deps = makeDeps({ earlyExit: vi.fn(() => ({ shouldExit: true, exitCode: 0 })) });

    expect(dispatchCli(deps)).toBe(true);

    expect(deps.exit).toHaveBeenCalledWith(0);
    expect(deps.guardBundlePath).not.toHaveBeenCalled();
    expect(deps.parseArgs).not.toHaveBeenCalled();
  });

  it('forwards a non-zero early exit code', () => {
    const deps = makeDeps({ earlyExit: vi.fn(() => ({ shouldExit: true, exitCode: 2 })) });
    dispatchCli(deps);
    expect(deps.exit).toHaveBeenCalledWith(2);
  });

  it('hands a windowed launch back to the caller without touching the subcommand path', () => {
    const deps = makeDeps();

    expect(dispatchCli(deps)).toBe(false);

    expect(deps.guardBundlePath).toHaveBeenCalledTimes(1);
    expect(deps.fetchComments).not.toHaveBeenCalled();
    expect(deps.reexec).not.toHaveBeenCalled();
    expect(deps.exit).not.toHaveBeenCalled();
  });

  it('runs the bundle-path guard before the subcommand, so the headless spawns survive it', () => {
    const order: string[] = [];
    const deps = makeDeps({
      guardBundlePath: vi.fn(() => void order.push('guard')),
      parseArgs: vi.fn(() => {
        order.push('parse');
        return makeArgs({ subcommand: 'fetch-comments', remoteUrl: 'https://host/o/r/pull/1' });
      }),
      needsReexec: vi.fn(() => {
        order.push('needsReexec');
        return false;
      }),
    });

    dispatchCli(deps);

    expect(order).toEqual(['guard', 'parse', 'needsReexec']);
  });

  it('re-execs instead of fetching when the headless launch needs it', () => {
    const deps = makeDeps({
      parseArgs: vi.fn(() =>
        makeArgs({ subcommand: 'fetch-comments', remoteUrl: 'https://host/o/r/pull/1' })
      ),
      needsReexec: vi.fn(() => true),
    });

    expect(dispatchCli(deps)).toBe(true);

    expect(deps.reexec).toHaveBeenCalledTimes(1);
    expect(deps.fetchComments).not.toHaveBeenCalled();
    expect(deps.exit).not.toHaveBeenCalled();
  });

  it('fetches comments for the parsed URL and exits zero', async () => {
    const deps = makeDeps({
      parseArgs: vi.fn(() =>
        makeArgs({
          subcommand: 'fetch-comments',
          remoteUrl: 'https://gitlab.com/g/p/-/merge_requests/7',
          allThreads: true,
        })
      ),
    });

    expect(dispatchCli(deps)).toBe(true);
    await vi.waitFor(() => expect(deps.exit).toHaveBeenCalledWith(0));

    expect(deps.fetchComments).toHaveBeenCalledWith('https://gitlab.com/g/p/-/merge_requests/7', {
      includeResolved: true,
    });
    expect(deps.logError).not.toHaveBeenCalled();
  });

  it('defaults to unresolved threads only', async () => {
    const deps = makeDeps({
      parseArgs: vi.fn(() =>
        makeArgs({ subcommand: 'fetch-comments', remoteUrl: 'https://host/o/r/pull/1' })
      ),
    });

    dispatchCli(deps);
    await vi.waitFor(() => expect(deps.exit).toHaveBeenCalledWith(0));

    expect(deps.fetchComments).toHaveBeenCalledWith('https://host/o/r/pull/1', {
      includeResolved: false,
    });
  });

  it('reports a rejected fetch on stderr and exits one', async () => {
    const deps = makeDeps({
      parseArgs: vi.fn(() =>
        makeArgs({ subcommand: 'fetch-comments', remoteUrl: 'https://host/o/r/pull/1' })
      ),
      fetchComments: vi.fn(async () => {
        throw new Error('gh: not authenticated');
      }),
    });

    dispatchCli(deps);
    await vi.waitFor(() => expect(deps.exit).toHaveBeenCalledWith(1));

    expect(deps.logError).toHaveBeenCalledWith('[fetch-comments] gh: not authenticated');
  });

  it('stringifies a non-Error rejection rather than printing [object Object]', async () => {
    const deps = makeDeps({
      parseArgs: vi.fn(() =>
        makeArgs({ subcommand: 'fetch-comments', remoteUrl: 'https://host/o/r/pull/1' })
      ),
      fetchComments: vi.fn(async () => {
        throw 'plain string failure';
      }),
    });

    dispatchCli(deps);
    await vi.waitFor(() => expect(deps.exit).toHaveBeenCalledWith(1));

    expect(deps.logError).toHaveBeenCalledWith('[fetch-comments] plain string failure');
  });
});
