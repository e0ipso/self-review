import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  SafeFsError,
  assertNoSymlinkAncestors,
  atomicReplace,
  inspectReplaceTarget,
  nodeFsLayer,
  writeExclusiveNoFollow,
} from './safe-fs';
import type { FsLayer } from './safe-fs';

let tmp: string;
let outside: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-safe-fs-'));
  outside = fs.mkdtempSync(path.join(os.tmpdir(), 'sr-safe-fs-outside-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
  fs.rmSync(outside, { recursive: true, force: true });
});

function codeOf(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    expect(error).toBeInstanceOf(SafeFsError);
    return (error as SafeFsError).code;
  }
  throw new Error('expected a SafeFsError');
}

describe('assertNoSymlinkAncestors', () => {
  it('accepts real directories and components that do not exist yet', () => {
    fs.mkdirSync(path.join(tmp, 'a', 'b'), { recursive: true });
    expect(() => assertNoSymlinkAncestors(tmp, 'a/b/file.txt')).not.toThrow();
    expect(() => assertNoSymlinkAncestors(tmp, 'a/missing/deeper/file.txt')).not.toThrow();
    expect(() => assertNoSymlinkAncestors(tmp, 'file.txt')).not.toThrow();
  });

  it('refuses a linked directory anywhere on the way to the leaf', () => {
    fs.mkdirSync(path.join(tmp, 'a'));
    fs.symlinkSync(outside, path.join(tmp, 'a', 'b'));
    expect(codeOf(() => assertNoSymlinkAncestors(tmp, 'a/b/file.txt'))).toBe('unsafe-link');
  });

  it('does not inspect the leaf itself', () => {
    fs.symlinkSync(path.join(outside, 'x'), path.join(tmp, 'leaf'));
    expect(() => assertNoSymlinkAncestors(tmp, 'leaf')).not.toThrow();
  });

  it('refuses a path that leaves the root lexically', () => {
    expect(codeOf(() => assertNoSymlinkAncestors(tmp, '../file.txt'))).toBe('unsupported-target');
    expect(codeOf(() => assertNoSymlinkAncestors(tmp, '/etc/passwd'))).toBe('unsupported-target');
  });
});

describe('writeExclusiveNoFollow', () => {
  it('refuses a dangling symlink at the leaf and leaves it in place', () => {
    const target = path.join(tmp, 'file.txt');
    fs.symlinkSync(path.join(outside, 'never-created'), target);

    expect(codeOf(() => writeExclusiveNoFollow(target, Buffer.from('x')))).toBe('unsafe-link');
    expect(fs.existsSync(path.join(outside, 'never-created'))).toBe(false);
    expect(fs.lstatSync(target).isSymbolicLink()).toBe(true);
  });

  it('refuses an existing regular file as io-error rather than truncating it', () => {
    const target = path.join(tmp, 'file.txt');
    fs.writeFileSync(target, 'keep');

    expect(codeOf(() => writeExclusiveNoFollow(target, Buffer.from('x')))).toBe('io-error');
    expect(fs.readFileSync(target, 'utf-8')).toBe('keep');
  });

  it('applies an exact mode when asked, bypassing the umask', () => {
    const target = path.join(tmp, 'file.txt');
    writeExclusiveNoFollow(target, Buffer.from('x'), { exactMode: 0o640 });
    expect(fs.statSync(target).mode & 0o777).toBe(0o640);
  });
});

describe('atomicReplace', () => {
  it('creates a missing target and replaces an existing one in place', () => {
    const target = path.join(tmp, 'file.txt');

    const first = atomicReplace(target, Buffer.from('one\n'));
    expect(first.replaced).toBe(false);
    expect(fs.readFileSync(target, 'utf-8')).toBe('one\n');

    const second = atomicReplace(target, Buffer.from('two\n'), {
      expectedIdentity: first.identity,
    });
    expect(second.replaced).toBe(true);
    expect(fs.readFileSync(target, 'utf-8')).toBe('two\n');
    expect(fs.readdirSync(tmp)).toEqual(['file.txt']);
  });

  it('refuses when the target is no longer the file that was inspected', () => {
    const target = path.join(tmp, 'file.txt');
    fs.writeFileSync(target, 'original');
    const identity = inspectReplaceTarget(target)!;
    fs.unlinkSync(target);
    fs.writeFileSync(target, 'swapped');

    expect(
      codeOf(() => atomicReplace(target, Buffer.from('new'), { expectedIdentity: identity }))
    ).toBe('identity-changed');
    expect(fs.readFileSync(target, 'utf-8')).toBe('swapped');
  });

  it('removes its temp file and keeps the old content when the rename fails', () => {
    const target = path.join(tmp, 'file.txt');
    fs.writeFileSync(target, 'original');
    const failingRename: FsLayer = {
      ...nodeFsLayer,
      renameSync: () => {
        const error: NodeJS.ErrnoException = new Error('EIO: injected');
        error.code = 'EIO';
        throw error;
      },
    };

    expect(codeOf(() => atomicReplace(target, Buffer.from('new'), { fs: failingRename }))).toBe(
      'io-error'
    );
    expect(fs.readFileSync(target, 'utf-8')).toBe('original');
    expect(fs.readdirSync(tmp)).toEqual(['file.txt']);
  });

  it('refuses a symlinked target without touching what it points at', () => {
    const victim = path.join(outside, 'victim.txt');
    fs.writeFileSync(victim, 'sentinel');
    const target = path.join(tmp, 'file.txt');
    fs.symlinkSync(victim, target);

    expect(codeOf(() => atomicReplace(target, Buffer.from('new')))).toBe('unsafe-link');
    expect(fs.readFileSync(victim, 'utf-8')).toBe('sentinel');
    expect(fs.readlinkSync(target)).toBe(victim);
  });
});

describe('atomicReplace: owner and modification policy', () => {
  function errno(code: string): NodeJS.ErrnoException {
    const error: NodeJS.ErrnoException = new Error(code);
    error.code = code;
    return error;
  }

  /** The real layer, with the target reported as owned by someone else. */
  function ownedByAnother(target: string, delta: { uid?: number; gid?: number }): FsLayer {
    return {
      ...nodeFsLayer,
      lstatSync(p) {
        const stats = fs.lstatSync(p);
        if (p === target) {
          if (delta.uid !== undefined) stats.uid = stats.uid + delta.uid;
          if (delta.gid !== undefined) stats.gid = stats.gid + delta.gid;
        }
        return stats;
      },
    };
  }

  it('leaves the replacement owned as it was when the owner already matches', () => {
    const target = path.join(tmp, 'file.txt');
    fs.writeFileSync(target, 'original');
    const before = fs.statSync(target);

    atomicReplace(target, Buffer.from('new'), { preserveOwner: true });

    const after = fs.statSync(target);
    expect(after.uid).toBe(before.uid);
    expect(after.gid).toBe(before.gid);
    expect(fs.readFileSync(target, 'utf-8')).toBe('new');
  });

  it('refuses up front, writing nothing, when another user owns the target and this process is not root', () => {
    if (process.geteuid?.() === 0) return; // root may chown freely; the refusal is for everyone else
    const target = path.join(tmp, 'file.txt');
    fs.writeFileSync(target, 'original');

    expect(
      codeOf(() =>
        atomicReplace(target, Buffer.from('new'), {
          preserveOwner: true,
          fs: ownedByAnother(target, { uid: 1 }),
        })
      )
    ).toBe('unsupported-target');
    expect(fs.readFileSync(target, 'utf-8')).toBe('original');
    expect(fs.readdirSync(tmp)).toEqual(['file.txt']);
  });

  it('removes the temp file and keeps the target when the owner cannot be restored', () => {
    const target = path.join(tmp, 'file.txt');
    fs.writeFileSync(target, 'original');
    // Only the group differs, so a chgrp is attempted — and refused by the OS.
    const layer: FsLayer = {
      ...ownedByAnother(target, { gid: 1 }),
      fchownSync() {
        throw errno('EPERM');
      },
    };

    expect(
      codeOf(() => atomicReplace(target, Buffer.from('new'), { preserveOwner: true, fs: layer }))
    ).toBe('unsupported-target');
    expect(fs.readFileSync(target, 'utf-8')).toBe('original');
    expect(fs.readdirSync(tmp)).toEqual(['file.txt']);
  });

  it('refuses a same-inode rewrite when asked to expect the file unmodified', () => {
    const target = path.join(tmp, 'file.txt');
    fs.writeFileSync(target, 'original');
    const identity = inspectReplaceTarget(target)!;
    fs.appendFileSync(target, ' and more');

    expect(
      codeOf(() =>
        atomicReplace(target, Buffer.from('new'), {
          expectedIdentity: identity,
          expectUnmodified: true,
        })
      )
    ).toBe('identity-changed');
    expect(fs.readFileSync(target, 'utf-8')).toBe('original and more');
    expect(fs.readdirSync(tmp)).toEqual(['file.txt']);
  });
});
