import { describe, it, expect } from 'vitest';
import { resolveReexecTarget } from './relaunch-guard';

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

  it('does not re-exec when the invoked path cannot be resolved', () => {
    // e.g. Finder passing a bare name that realpath can't find.
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
