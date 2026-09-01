import { resolve } from 'path';
import { describe, it, expect } from 'vitest';
import {
  resolveInvokedPath,
  resolveReexecExit,
  resolveReexecTarget,
} from './relaunch-guard';

// Real bundle binary and a symlink to it, as they appear on a Homebrew install.
const REAL = '/Applications/Self Review.app/Contents/MacOS/Self Review';
const SYMLINK = '/opt/homebrew/bin/self-review';

// A realpath resolver that mimics the symlink → real binary mapping and throws
// for anything unknown (as realpathSync does for missing paths).
function makeRealpath(map: Record<string, string>) {
  return (p: string): string => {
    if (p in map) return map[p];
    throw new Error(`ENOENT: ${p}`);
  };
}

const realpath = makeRealpath({ [REAL]: REAL, [SYMLINK]: REAL });

describe('resolveReexecTarget', () => {
  it('re-execs from the real binary when launched via a symlink', () => {
    expect(
      resolveReexecTarget('darwin', true, SYMLINK, REAL, {}, realpath)
    ).toBe(REAL);
  });

  it('re-execs when launched by a bare command name resolved on PATH', () => {
    // The Homebrew case: typing `self-review` passes the bare name as argv0,
    // which the shell found at SYMLINK via PATH.
    const fileExists = (p: string): boolean => p === SYMLINK;
    expect(
      resolveReexecTarget(
        'darwin',
        true,
        'self-review',
        REAL,
        { PATH: '/usr/bin:/opt/homebrew/bin' },
        realpath,
        fileExists
      )
    ).toBe(REAL);
  });

  it('does not re-exec for a bare name that is not on PATH', () => {
    const fileExists = (): boolean => false;
    expect(
      resolveReexecTarget(
        'darwin',
        true,
        'self-review',
        REAL,
        { PATH: '/usr/bin:/opt/homebrew/bin' },
        realpath,
        fileExists
      )
    ).toBeNull();
  });

  it('does not re-exec when launched directly from the real binary', () => {
    expect(
      resolveReexecTarget('darwin', true, REAL, REAL, {}, realpath)
    ).toBeNull();
  });

  it('never re-execs on non-macOS platforms', () => {
    expect(
      resolveReexecTarget('linux', true, SYMLINK, REAL, {}, realpath)
    ).toBeNull();
  });

  it('never re-execs in unpackaged/dev builds', () => {
    expect(
      resolveReexecTarget('darwin', false, SYMLINK, REAL, {}, realpath)
    ).toBeNull();
  });

  it('does not loop: skips when the re-exec guard env is set', () => {
    expect(
      resolveReexecTarget(
        'darwin',
        true,
        SYMLINK,
        REAL,
        { SELF_REVIEW_REEXECED: '1' },
        realpath
      )
    ).toBeNull();
  });

  it('does not re-exec when a bare invoked name is not on PATH', () => {
    // e.g. a bare name with no PATH to resolve it against.
    expect(
      resolveReexecTarget('darwin', true, 'Self Review', REAL, {}, realpath)
    ).toBeNull();
  });

  it('does not re-exec when the symlink points somewhere else entirely', () => {
    const other = makeRealpath({
      [REAL]: REAL,
      [SYMLINK]: '/usr/bin/unrelated',
    });
    expect(
      resolveReexecTarget('darwin', true, SYMLINK, REAL, {}, other)
    ).toBeNull();
  });

  it('ignores an empty invoked path', () => {
    expect(
      resolveReexecTarget('darwin', true, '', REAL, {}, realpath)
    ).toBeNull();
  });
});

describe('resolveInvokedPath', () => {
  it('resolves an absolute path as-is', () => {
    expect(resolveInvokedPath(SYMLINK, {})).toBe(SYMLINK);
  });

  it('resolves a relative path against the cwd', () => {
    expect(resolveInvokedPath('./bin/self-review', {})).toBe(
      resolve('./bin/self-review')
    );
  });

  it('resolves a bare name against PATH', () => {
    const fileExists = (p: string): boolean => p === SYMLINK;
    expect(
      resolveInvokedPath(
        'self-review',
        { PATH: '/usr/bin:/opt/homebrew/bin' },
        fileExists
      )
    ).toBe(SYMLINK);
  });

  it('returns the first PATH match', () => {
    const fileExists = (): boolean => true;
    expect(
      resolveInvokedPath(
        'self-review',
        { PATH: '/first:/second' },
        fileExists
      )
    ).toBe('/first/self-review');
  });

  it('returns null for a bare name absent from PATH', () => {
    expect(
      resolveInvokedPath('self-review', { PATH: '/usr/bin' }, () => false)
    ).toBeNull();
  });

  it('returns null for a bare name with no PATH', () => {
    expect(resolveInvokedPath('self-review', {}, () => true)).toBeNull();
  });
});

describe('resolveReexecExit', () => {
  it('forwards a clean exit status', () => {
    expect(resolveReexecExit({ status: 0, signal: null })).toEqual({
      signal: null,
      code: 0,
    });
  });

  it('forwards a non-zero exit status', () => {
    expect(resolveReexecExit({ status: 3, signal: null })).toEqual({
      signal: null,
      code: 3,
    });
  });

  it('exits non-zero when the spawn fails', () => {
    expect(
      resolveReexecExit({
        status: null,
        signal: null,
        error: new Error('ENOENT'),
      })
    ).toEqual({ signal: null, code: 1 });
  });

  it('re-raises the signal when the child is killed', () => {
    expect(resolveReexecExit({ status: null, signal: 'SIGINT' })).toEqual({
      signal: 'SIGINT',
      code: 1,
    });
  });

  it('exits non-zero when status is null with no error or signal', () => {
    expect(resolveReexecExit({ status: null, signal: null })).toEqual({
      signal: null,
      code: 1,
    });
  });
});
