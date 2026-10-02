// apply-suggestion.test.ts
// The apply engine writes real bytes, so these tests use a real temporary
// destination directory rather than a mocked `fs`: the assertions that matter
// most ("nothing was written", "the trailing newline survived") are about the
// file on disk, and a mock cannot witness them.

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  chmodSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { applySuggestion, isRepositoryControlPath } from './apply-suggestion';
import { nodeFsLayer } from './safe-fs';
import type { FsLayer } from './safe-fs';
import type { LineRange, Suggestion } from './types';

const FILE = 'src/app.ts';
const ORIGINAL = ['const a = 1;', 'const b = 2;', 'const c = 3;'];

let root: string;

/** Write `content` verbatim at `relative` under the destination root. */
function seed(relative: string, content: string): string {
  const absolute = join(root, relative);
  mkdirSync(join(absolute, '..'), { recursive: true });
  writeFileSync(absolute, content, 'utf8');
  return absolute;
}

function read(relative: string): string {
  return readFileSync(join(root, relative), 'utf8');
}

function request(overrides: {
  filePath?: string;
  destinationRoot?: string;
  lineRange?: LineRange | null;
  suggestion?: Suggestion;
}) {
  return {
    destinationRoot: overrides.destinationRoot ?? root,
    filePath: overrides.filePath ?? FILE,
    lineRange:
      overrides.lineRange === undefined
        ? { side: 'new' as const, start: 2, end: 2 }
        : overrides.lineRange,
    suggestion: overrides.suggestion ?? {
      originalCode: 'const b = 2;',
      proposedCode: 'const b = 22;',
    },
  };
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'self-review-apply-'));
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('applySuggestion', () => {
  describe('applied', () => {
    it('replaces only the anchored line and keeps the trailing newline', () => {
      seed(FILE, `${ORIGINAL.join('\n')}\n`);

      const result = applySuggestion(request({}));

      expect(result).toEqual({
        status: 'applied',
        filePath: FILE,
        absolutePath: join(root, FILE),
        replacedLines: 1,
      });
      expect(read(FILE)).toBe('const a = 1;\nconst b = 22;\nconst c = 3;\n');
    });

    it('leaves a file that ended without a newline still ending without one', () => {
      seed(FILE, ORIGINAL.join('\n'));

      const result = applySuggestion(
        request({
          lineRange: { side: 'new', start: 3, end: 3 },
          suggestion: { originalCode: 'const c = 3;', proposedCode: 'const c = 33;' },
        })
      );

      expect(result.status).toBe('applied');
      expect(read(FILE)).toBe('const a = 1;\nconst b = 2;\nconst c = 33;');
    });

    it('replaces a multi-line anchor with a proposal of a different length', () => {
      seed(FILE, `${ORIGINAL.join('\n')}\n`);

      const result = applySuggestion(
        request({
          lineRange: { side: 'new', start: 1, end: 2 },
          suggestion: {
            originalCode: 'const a = 1;\nconst b = 2;',
            proposedCode: 'const [a, b] = [1, 2];',
          },
        })
      );

      expect(result).toMatchObject({ status: 'applied', replacedLines: 2 });
      expect(read(FILE)).toBe('const [a, b] = [1, 2];\nconst c = 3;\n');
    });

    it('keeps CRLF terminators when the whole anchored region is CRLF', () => {
      seed(FILE, 'const a = 1;\r\nconst b = 2;\r\nconst c = 3;\r\n');

      const result = applySuggestion(
        request({
          // The diff parser hands the `\r` through in DiffLine.content, so the
          // recorded original code carries it too.
          suggestion: { originalCode: 'const b = 2;\r', proposedCode: 'const b = 22;' },
        })
      );

      expect(result.status).toBe('applied');
      expect(read(FILE)).toBe('const a = 1;\r\nconst b = 22;\r\nconst c = 3;\r\n');
    });
  });

  describe('refused', () => {
    it('refuses a file-level suggestion and writes nothing', () => {
      const before = `${ORIGINAL.join('\n')}\n`;
      seed(FILE, before);

      const result = applySuggestion(request({ lineRange: null }));

      expect(result).toMatchObject({ status: 'refused', reason: 'no-anchor', filePath: FILE });
      expect(read(FILE)).toBe(before);
    });

    it('refuses an old-side anchor, which names lines the working file does not have', () => {
      const before = `${ORIGINAL.join('\n')}\n`;
      seed(FILE, before);

      const result = applySuggestion(request({ lineRange: { side: 'old', start: 2, end: 2 } }));

      expect(result).toMatchObject({ status: 'refused', reason: 'old-side-anchor' });
      expect(read(FILE)).toBe(before);
    });

    it('refuses when the on-disk lines drifted from the recorded original code', () => {
      const before = 'const a = 1;\nconst b = 999;\nconst c = 3;\n';
      seed(FILE, before);

      const result = applySuggestion(request({}));

      expect(result).toMatchObject({ status: 'refused', reason: 'context-mismatch' });
      expect(read(FILE)).toBe(before);
    });

    it('refuses on whitespace-only drift: the comparison is byte for byte', () => {
      const before = 'const a = 1;\n  const b = 2;\nconst c = 3;\n';
      seed(FILE, before);

      const result = applySuggestion(request({}));

      expect(result).toMatchObject({ status: 'refused', reason: 'context-mismatch' });
      expect(read(FILE)).toBe(before);
    });

    it('refuses when the file is not in the destination directory', () => {
      const result = applySuggestion(request({ filePath: 'src/gone.ts' }));

      expect(result).toMatchObject({ status: 'refused', reason: 'file-missing' });
    });

    it('refuses a relative destination root instead of resolving it against the cwd', () => {
      const result = applySuggestion(request({ destinationRoot: 'relative/root' }));

      expect(result).toMatchObject({ status: 'refused', reason: 'destination-not-absolute' });
    });

    it('refuses a path that escapes the destination root', () => {
      const outside = join(root, 'outside.txt');
      writeFileSync(outside, 'untouched\n', 'utf8');
      const inner = join(root, 'repo');
      mkdirSync(inner, { recursive: true });

      const result = applySuggestion(
        request({
          destinationRoot: inner,
          filePath: '../outside.txt',
          lineRange: { side: 'new', start: 1, end: 1 },
          suggestion: { originalCode: 'untouched', proposedCode: 'clobbered' },
        })
      );

      expect(result).toMatchObject({ status: 'refused', reason: 'path-escapes-destination' });
      expect(readFileSync(outside, 'utf8')).toBe('untouched\n');
    });

    it('refuses an absolute file path', () => {
      const result = applySuggestion(request({ filePath: join(root, FILE) }));

      expect(result).toMatchObject({ status: 'refused', reason: 'path-escapes-destination' });
    });

    it('refuses an anchor past the end of the file', () => {
      const before = `${ORIGINAL.join('\n')}\n`;
      seed(FILE, before);

      const result = applySuggestion(
        request({
          lineRange: { side: 'new', start: 9, end: 9 },
          suggestion: { originalCode: 'const b = 2;', proposedCode: 'const b = 22;' },
        })
      );

      expect(result).toMatchObject({ status: 'refused', reason: 'anchor-out-of-range' });
      expect(read(FILE)).toBe(before);
    });

    it('refuses a file that is not valid UTF-8 rather than rewriting it lossily', () => {
      const absolute = join(root, 'blob.bin');
      writeFileSync(absolute, Buffer.from([0xff, 0xfe, 0x0a]));

      const result = applySuggestion(
        request({
          filePath: 'blob.bin',
          lineRange: { side: 'new', start: 1, end: 1 },
          suggestion: { originalCode: 'anything', proposedCode: 'else' },
        })
      );

      expect(result).toMatchObject({ status: 'refused', reason: 'file-not-utf8' });
      expect(readFileSync(absolute)).toEqual(Buffer.from([0xff, 0xfe, 0x0a]));
    });

    it('refuses a directory rather than treating it as a file', () => {
      mkdirSync(join(root, 'src'), { recursive: true });

      const result = applySuggestion(
        request({
          filePath: 'src',
          lineRange: { side: 'new', start: 1, end: 1 },
          suggestion: { originalCode: '', proposedCode: 'x' },
        })
      );

      expect(result).toMatchObject({ status: 'refused', reason: 'file-unreadable' });
    });

    it('names no file contents in the refusal detail', () => {
      seed(FILE, 'const a = 1;\nsecret = "hunter2";\nconst c = 3;\n');

      const result = applySuggestion(request({}));

      expect(result.status).toBe('refused');
      if (result.status === 'refused') {
        expect(result.detail).not.toContain('hunter2');
      }
    });
  });
});

function errno(code: string): NodeJS.ErrnoException {
  const error: NodeJS.ErrnoException = new Error(code);
  error.code = code;
  return error;
}

/** An fs layer that fails every call, proving a refusal happened before any I/O. */
function untouchableFs(): FsLayer {
  const fail = () => {
    throw new Error('the filesystem was touched');
  };
  return {
    openSync: fail,
    writeSync: fail,
    fsyncSync: fail,
    fchmodSync: fail,
    fchownSync: fail,
    closeSync: fail,
    renameSync: fail,
    unlinkSync: fail,
    lstatSync: fail,
    fstatSync: fail,
    readFileSync: fail,
    mkdirSync: fail,
    realpathSync: fail,
  };
}

/** ENOSPC after `budget` bytes, the way a full disk fails: some bytes land first. */
function enospcAfter(budget: number): FsLayer {
  let remaining = budget;
  return {
    ...nodeFsLayer,
    writeSync(fd, buffer) {
      if (remaining <= 0) throw errno('ENOSPC');
      const slice = buffer.subarray(0, Math.min(buffer.length, remaining));
      const written = nodeFsLayer.writeSync(fd, slice);
      remaining -= written;
      if (written < buffer.length) throw errno('ENOSPC');
      return written;
    },
  };
}

const PROBE = 'before\nremove\nafter\n';

describe('applySuggestion: proposal semantics', () => {
  it('deletes the anchored lines when the proposal is empty, inserting no blank line', () => {
    seed(FILE, PROBE);

    const result = applySuggestion(
      request({
        lineRange: { side: 'new', start: 2, end: 2 },
        suggestion: { originalCode: 'remove', proposedCode: '' },
      })
    );

    expect(result).toMatchObject({ status: 'applied', replacedLines: 1 });
    expect(read(FILE)).toBe('before\nafter\n');
  });

  it('treats one trailing newline on the proposal as a terminator, not an extra line', () => {
    seed(FILE, PROBE);

    const result = applySuggestion(
      request({
        lineRange: { side: 'new', start: 2, end: 2 },
        suggestion: { originalCode: 'remove', proposedCode: 'kept\n' },
      })
    );

    expect(result.status).toBe('applied');
    expect(read(FILE)).toBe('before\nkept\nafter\n');
  });

  it('keeps a second trailing newline as a genuine blank line', () => {
    seed(FILE, PROBE);

    const result = applySuggestion(
      request({
        lineRange: { side: 'new', start: 2, end: 2 },
        suggestion: { originalCode: 'remove', proposedCode: 'kept\n\n' },
      })
    );

    expect(result.status).toBe('applied');
    expect(read(FILE)).toBe('before\nkept\n\nafter\n');
  });

  it('deleting the last line of a file without a final newline leaves none', () => {
    seed(FILE, 'before\nremove');

    const result = applySuggestion(
      request({
        lineRange: { side: 'new', start: 2, end: 2 },
        suggestion: { originalCode: 'remove', proposedCode: '' },
      })
    );

    expect(result.status).toBe('applied');
    expect(read(FILE)).toBe('before');
  });

  it('deleting every line leaves an empty file rather than a lone newline', () => {
    seed(FILE, 'only\n');

    const result = applySuggestion(
      request({
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode: 'only', proposedCode: '' },
      })
    );

    expect(result.status).toBe('applied');
    expect(read(FILE)).toBe('');
  });
});

describe('applySuggestion: anchors are validated before any I/O', () => {
  const cases: Array<[string, LineRange]> = [
    ['NaN start', { side: 'new', start: Number.NaN, end: 1 }],
    ['Infinity end', { side: 'new', start: 1, end: Number.POSITIVE_INFINITY }],
    ['zero start', { side: 'new', start: 0, end: 1 }],
    ['fractional start', { side: 'new', start: 1.5, end: 2 }],
    ['reversed range', { side: 'new', start: 3, end: 2 }],
    ['negative end', { side: 'new', start: 1, end: -1 }],
    ['unknown side', { side: 'sideways' as 'new', start: 1, end: 1 }],
  ];

  for (const [name, lineRange] of cases) {
    it(`refuses a ${name} without touching the filesystem`, () => {
      const result = applySuggestion(
        request({ lineRange, suggestion: { originalCode: '', proposedCode: 'injected' } }),
        { fs: untouchableFs() }
      );

      expect(result).toMatchObject({ status: 'refused', reason: 'invalid-anchor' });
    });
  }

  it('refuses a NaN anchor with an empty original rather than prepending the proposal', () => {
    seed(FILE, PROBE);

    const result = applySuggestion(
      request({
        lineRange: { side: 'new', start: Number.NaN, end: Number.NaN },
        suggestion: { originalCode: '', proposedCode: 'injected' },
      })
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'invalid-anchor' });
    expect(read(FILE)).toBe(PROBE);
  });
});

describe('applySuggestion: repository control files', () => {
  it('classifies .git at any depth, as a directory or a file, as a control path', () => {
    expect(isRepositoryControlPath('.git/config')).toBe(true);
    expect(isRepositoryControlPath('.git')).toBe(true);
    expect(isRepositoryControlPath('vendor/lib/.git/hooks/pre-commit')).toBe(true);
    expect(isRepositoryControlPath('sub/.GIT/HEAD')).toBe(true);
    expect(isRepositoryControlPath('src/app.ts')).toBe(false);
    expect(isRepositoryControlPath('.gitignore')).toBe(false);
    expect(isRepositoryControlPath('.gitmodules')).toBe(false);
    expect(isRepositoryControlPath('docs/.github/workflows/ci.yml')).toBe(false);
  });

  it('refuses .git/config and leaves it byte for byte, before any I/O', () => {
    const before = '[core]\n\trepositoryformatversion = 0\n';
    seed('.git/config', before);

    const result = applySuggestion(
      request({
        filePath: '.git/config',
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode: '[core]', proposedCode: '[core]\n\tbare = true' },
      }),
      { fs: untouchableFs() }
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'control-file' });
    expect(read('.git/config')).toBe(before);
  });

  it('refuses a nested repository’s control files too', () => {
    const before = 'ref: refs/heads/main\n';
    seed('vendor/dep/.git/HEAD', before);

    const result = applySuggestion(
      request({
        filePath: 'vendor/dep/.git/HEAD',
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode: 'ref: refs/heads/main', proposedCode: 'ref: refs/heads/evil' },
      })
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'control-file' });
    expect(read('vendor/dep/.git/HEAD')).toBe(before);
  });
});

describe('applySuggestion: physical containment', () => {
  let outside: string;

  beforeEach(() => {
    outside = mkdtempSync(join(tmpdir(), 'self-review-apply-outside-'));
  });

  afterEach(() => {
    rmSync(outside, { recursive: true, force: true });
  });

  it('refuses a leaf symlink and leaves the outside file untouched', () => {
    const target = join(outside, 'target.txt');
    writeFileSync(target, 'SENTINEL\n', 'utf8');
    symlinkSync(target, join(root, 'linked.txt'));

    const result = applySuggestion(
      request({
        filePath: 'linked.txt',
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode: 'SENTINEL', proposedCode: 'OVERWRITTEN' },
      })
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'unsafe-target' });
    expect(readFileSync(target, 'utf8')).toBe('SENTINEL\n');
    expect(statSync(join(root, 'linked.txt'), { throwIfNoEntry: true }).isFile()).toBe(true);
  });

  it('refuses an ancestor symlink and leaves the outside file untouched', () => {
    mkdirSync(join(outside, 'dir'));
    const target = join(outside, 'dir', 'f.txt');
    writeFileSync(target, 'ANC\n', 'utf8');
    symlinkSync(join(outside, 'dir'), join(root, 'ancestor'));

    const result = applySuggestion(
      request({
        filePath: 'ancestor/f.txt',
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode: 'ANC', proposedCode: 'OVERWRITTEN' },
      })
    );

    expect(result).toMatchObject({ status: 'refused', reason: 'unsafe-target' });
    expect(readFileSync(target, 'utf8')).toBe('ANC\n');
  });

  it('refuses a hard-linked file rather than detaching the other name', () => {
    const inside = seed('src/app.ts', `${ORIGINAL.join('\n')}\n`);
    const alias = join(outside, 'alias.ts');
    linkSync(inside, alias);

    const result = applySuggestion(request({}));

    expect(result).toMatchObject({ status: 'refused', reason: 'unsafe-target' });
    expect(read(FILE)).toBe(`${ORIGINAL.join('\n')}\n`);
    expect(readFileSync(alias, 'utf8')).toBe(`${ORIGINAL.join('\n')}\n`);
  });

  it('refuses a destination root that does not exist', () => {
    const result = applySuggestion(request({ destinationRoot: join(outside, 'missing') }));

    expect(result).toMatchObject({ status: 'refused', reason: 'destination-missing' });
  });

  it('refuses a dot-dot path lexically, before resolving anything', () => {
    const result = applySuggestion(request({ filePath: 'src/../../escape.ts' }), {
      fs: untouchableFs(),
    });

    expect(result).toMatchObject({ status: 'refused', reason: 'path-escapes-destination' });
  });
});

describe('applySuggestion: the write is transactional', () => {
  it('refuses when the file was replaced between the read and the commit', () => {
    const absolute = seed(FILE, `${ORIGINAL.join('\n')}\n`);
    // Swap the inode out between the engine's read and its commit.
    const swapping: FsLayer = {
      ...nodeFsLayer,
      readFileSync(fd) {
        const bytes = nodeFsLayer.readFileSync(fd);
        unlinkSync(absolute);
        writeFileSync(absolute, bytes);
        return bytes;
      },
    };

    const result = applySuggestion(request({}), { fs: swapping });

    expect(result).toMatchObject({ status: 'refused', reason: 'file-changed' });
    expect(read(FILE)).toBe(`${ORIGINAL.join('\n')}\n`);
    expect(readdirSync(join(root, 'src'))).toEqual(['app.ts']);
  });

  it('refuses when the file was rewritten in place between the read and the commit', () => {
    const absolute = seed(FILE, `${ORIGINAL.join('\n')}\n`);
    const rewriting: FsLayer = {
      ...nodeFsLayer,
      readFileSync(fd) {
        const bytes = nodeFsLayer.readFileSync(fd);
        writeFileSync(absolute, `${bytes.toString('utf8')}// appended\n`);
        return bytes;
      },
    };

    const result = applySuggestion(request({}), { fs: rewriting });

    expect(result).toMatchObject({ status: 'refused', reason: 'file-changed' });
    expect(read(FILE)).toBe(`${ORIGINAL.join('\n')}\n// appended\n`);
  });

  it('leaves the target intact and no temp file behind when the disk fills mid-write', () => {
    const before = `${ORIGINAL.join('\n')}\n`;
    seed(FILE, before);

    const result = applySuggestion(request({}), { fs: enospcAfter(2) });

    expect(result).toMatchObject({ status: 'refused', reason: 'write-failed' });
    expect(read(FILE)).toBe(before);
    expect(readdirSync(join(root, 'src'))).toEqual(['app.ts']);
  });

  it('preserves the permission bits of the file it replaced', () => {
    const absolute = seed(FILE, `${ORIGINAL.join('\n')}\n`);
    chmodSync(absolute, 0o640);

    const result = applySuggestion(request({}));

    expect(result.status).toBe('applied');
    expect(statSync(absolute).mode & 0o777).toBe(0o640);
    expect(read(FILE)).toBe('const a = 1;\nconst b = 22;\nconst c = 3;\n');
  });

  it('replaces the file through a rename, so the result is a fresh inode with one link', () => {
    const absolute = seed(FILE, `${ORIGINAL.join('\n')}\n`);
    const before = statSync(absolute).ino;

    expect(applySuggestion(request({})).status).toBe('applied');

    const after = statSync(absolute);
    expect(after.ino).not.toBe(before);
    expect(after.nlink).toBe(1);
    expect(readdirSync(join(root, 'src'))).toEqual(['app.ts']);
  });
});
