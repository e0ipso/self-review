import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  chmodSync,
  closeSync,
  mkdirSync,
  mkdtempSync,
  openSync,
  rmSync,
  symlinkSync,
  writeFileSync,
  writeSync,
  ftruncateSync,
} from 'fs';
import { execFileSync } from 'child_process';
import { tmpdir } from 'os';
import { join } from 'path';
import {
  generateSyntheticDiffs,
  loadSyntheticFiles,
  quoteGitPath,
  readSyntheticSource,
} from './synthetic-diff';
import { BINARY_SNIFF_BYTES, MAX_SOURCE_FILE_BYTES } from './input-budgets';
import { parseDiff } from './diff-parser';
import { gitSync } from './test-support/git-env';

// Names git writes verbatim, names git quotes, and names that would run past
// the end of a header line.
const LITERAL_NAMES = [
  'plain.txt',
  'my file.txt',
  ' leading-space.txt',
  'trailing-space .txt',
  'café.txt',
  'tab\there.txt',
  'new\nline.txt',
  'quote".txt',
  'back\\slash.txt',
  'nested/dir/deep file.txt',
];

describe('quoteGitPath', () => {
  it('leaves plain ASCII paths verbatim', () => {
    expect(quoteGitPath('a/src/foo.ts')).toBe('a/src/foo.ts');
    expect(quoteGitPath('a/my file.txt')).toBe('a/my file.txt');
  });

  it('escapes control characters, quotes, backslashes and non-ASCII bytes', () => {
    expect(quoteGitPath('a/new\nline.txt')).toBe('"a/new\\nline.txt"');
    expect(quoteGitPath('a/tab\there.txt')).toBe('"a/tab\\there.txt"');
    expect(quoteGitPath('a/quote".txt')).toBe('"a/quote\\".txt"');
    expect(quoteGitPath('a/back\\slash.txt')).toBe('"a/back\\\\slash.txt"');
    expect(quoteGitPath('a/café.txt')).toBe('"a/caf\\303\\251.txt"');
  });
});

describe('generateSyntheticDiffs', () => {
  let root: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'self-review-test-synthetic-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
  });

  function write(name: string, content: string | Buffer): void {
    const full = join(root, name);
    mkdirSync(join(full, '..'), { recursive: true });
    writeFileSync(full, content);
  }

  it('round-trips literal names through the diff parser with their own bytes', () => {
    for (const name of LITERAL_NAMES) {
      write(name, `content of ${name}\n`);
    }

    const files = parseDiff(generateSyntheticDiffs(LITERAL_NAMES, root).diff);

    expect(files.map(file => file.newPath).sort()).toEqual([...LITERAL_NAMES].sort());
    for (const file of files) {
      expect(file.changeType).toBe('added');
      expect(file.hunks[0].lines.map(line => line.content)).toEqual(
        `content of ${file.newPath}`.split('\n')
      );
    }
  });

  it('writes the same headers git writes for the same names', () => {
    gitSync(['init', '-q', root]);
    for (const name of LITERAL_NAMES) {
      write(name, 'content\n');
    }
    gitSync(['-C', root, 'add', '--', ...LITERAL_NAMES]);
    const gitHeaders = gitSync([
      '-c',
      'core.quotePath=true',
      '-c',
      'diff.mnemonicPrefix=false',
      '-C',
      root,
      'diff',
      '--cached',
    ])
      .split('\n')
      .filter(line => line.startsWith('diff --git '));

    const ourHeaders = generateSyntheticDiffs(LITERAL_NAMES, root)
      .diff.split('\n')
      .filter(line => line.startsWith('diff --git '));

    expect(ourHeaders.sort()).toEqual(gitHeaders.sort());
  });

  it('marks a binary file with an awkward name as binary', () => {
    write('image\n1.png', Buffer.from([0x00, 0x01, 0x02, 0xff]));

    const files = parseDiff(generateSyntheticDiffs(['image\n1.png'], root).diff);

    expect(files).toHaveLength(1);
    expect(files[0].newPath).toBe('image\n1.png');
    expect(files[0].isBinary).toBe(true);
  });

  it('skips names that disappeared between listing and reading', () => {
    write('kept.txt', 'kept\n');

    const files = parseDiff(generateSyntheticDiffs(['kept.txt', 'gone.txt'], root).diff);

    expect(files.map(file => file.newPath)).toEqual(['kept.txt']);
  });
});

describe('synthetic diff input budgets', () => {
  let root: string;
  let outside: string;

  beforeEach(() => {
    root = mkdtempSync(join(tmpdir(), 'self-review-test-synthetic-budget-'));
    outside = mkdtempSync(join(tmpdir(), 'self-review-test-synthetic-outside-'));
  });

  afterEach(() => {
    rmSync(root, { recursive: true, force: true });
    rmSync(outside, { recursive: true, force: true });
  });

  /** A file of `size` bytes that occupies (almost) no disk: `head`, then a hole. */
  function sparseFile(name: string, head: string, size: number): string {
    const full = join(root, name);
    const fd = openSync(full, 'w');
    try {
      writeSync(fd, head);
      ftruncateSync(fd, size);
    } finally {
      closeSync(fd);
    }
    return full;
  }

  it('represents an untracked symlink by its link text, as git does, never by its target', () => {
    const sentinel = join(outside, 'secret.txt');
    writeFileSync(sentinel, 'OUTSIDE-SENTINEL-CONTENT\n');
    symlinkSync(sentinel, join(root, 'link-to-file'));
    symlinkSync(outside, join(root, 'link-to-dir'));

    const { diff } = generateSyntheticDiffs(['link-to-file', 'link-to-dir'], root);
    const { files, diagnostics } = loadSyntheticFiles(['link-to-file', 'link-to-dir'], root);

    expect(diff).not.toContain('OUTSIDE-SENTINEL');
    expect(diff).toContain('new file mode 120000');
    expect(diagnostics).toEqual([]);
    const contentOf = (path: string) =>
      files.find(file => file.newPath === path)?.hunks[0].lines.map(line => line.content);
    expect(contentOf('link-to-file')).toEqual([sentinel]);
    expect(contentOf('link-to-dir')).toEqual([outside]);
  });

  it('samples only a bounded prefix of a multi-GiB binary file', () => {
    const full = sparseFile('huge.bin', 'PK', 4 * 1024 * 1024 * 1024);

    const started = Date.now();
    const sample = readSyntheticSource(full);
    const { files } = loadSyntheticFiles(['huge.bin'], root);
    const elapsed = Date.now() - started;

    expect(sample.kind).toBe('binary');
    expect(sample.bytesRead).toBeLessThanOrEqual(BINARY_SNIFF_BYTES);
    expect(files).toHaveLength(1);
    expect(files[0].isBinary).toBe(true);
    expect(elapsed).toBeLessThan(2000);
  });

  it('lists a text file over the per-file budget without reading it whole', () => {
    // Text for the whole sniff window, then a hole far past the budget.
    const full = sparseFile('huge.log', 'x'.repeat(BINARY_SNIFF_BYTES * 2), 2 * 1024 * 1024 * 1024);
    writeFileSync(join(root, 'small.txt'), 'small\n');

    const sample = readSyntheticSource(full);
    const { files, diagnostics } = loadSyntheticFiles(['huge.log', 'small.txt'], root);

    expect(sample.kind).toBe('too-large');
    expect(sample.bytesRead).toBeLessThanOrEqual(BINARY_SNIFF_BYTES);
    const huge = files.find(file => file.newPath === 'huge.log');
    expect(huge).toBeDefined();
    expect(huge!.changeType).toBe('added');
    expect(huge!.hunks).toEqual([]);
    expect(huge!.omittedReason).toMatch(/per-file/);
    expect(files.find(file => file.newPath === 'small.txt')?.hunks[0].lines[0].content).toBe(
      'small'
    );
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain('huge.log');
    expect(diagnostics[0]).toContain('5 MiB');
  });

  it('reads a text file exactly at the per-file budget', () => {
    writeFileSync(join(root, 'edge.txt'), 'y'.repeat(MAX_SOURCE_FILE_BYTES));

    const { files, diagnostics } = loadSyntheticFiles(['edge.txt'], root);

    expect(diagnostics).toEqual([]);
    expect(files[0].omittedReason).toBeUndefined();
    expect(files[0].hunks[0].lines[0].content).toHaveLength(MAX_SOURCE_FILE_BYTES);
  });

  it('stops reading once the aggregate budget is spent and lists every remaining file', () => {
    writeFileSync(join(root, 'a.txt'), 'a'.repeat(59) + '\n');
    writeFileSync(join(root, 'b.txt'), 'b'.repeat(59) + '\n');
    writeFileSync(join(root, 'c.txt'), 'c\n');

    const { files, diagnostics } = loadSyntheticFiles(['a.txt', 'b.txt', 'c.txt'], root, {
      budgets: { maxTotalBytes: 100 },
    });

    expect(files.map(file => file.newPath)).toEqual(['a.txt', 'b.txt', 'c.txt']);
    expect(files[0].omittedReason).toBeUndefined();
    expect(files[1].omittedReason).toMatch(/total read budget/);
    // Once the budget is spent nothing more is read, even a file that would fit.
    expect(files[2].omittedReason).toMatch(/total read budget/);
    expect(files[1].hunks).toEqual([]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toContain('2 files');
  });

  it.skipIf(process.platform === 'win32')('skips a FIFO without blocking on it', () => {
    execFileSync('mkfifo', [join(root, 'pipe')]);
    writeFileSync(join(root, 'kept.txt'), 'kept\n');

    const { files } = loadSyntheticFiles(['pipe', 'kept.txt'], root);

    expect(files.map(file => file.newPath)).toEqual(['kept.txt']);
  });

  it.skipIf(process.platform === 'win32' || process.getuid?.() === 0)(
    'names an unreadable file in a diagnostic instead of dropping it silently',
    () => {
      writeFileSync(join(root, 'locked.txt'), 'locked\n');
      chmodSync(join(root, 'locked.txt'), 0o000);

      const { files, diagnostics } = loadSyntheticFiles(['locked.txt'], root);

      expect(files).toEqual([]);
      expect(diagnostics).toHaveLength(1);
      expect(diagnostics[0]).toContain('locked.txt');
      expect(diagnostics[0]).toContain('EACCES');
    }
  );
});
