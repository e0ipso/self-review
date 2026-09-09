import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { generateSyntheticDiffs, quoteGitPath } from './synthetic-diff';
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

    const files = parseDiff(generateSyntheticDiffs(LITERAL_NAMES, root));

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
      .split('\n')
      .filter(line => line.startsWith('diff --git '));

    expect(ourHeaders.sort()).toEqual(gitHeaders.sort());
  });

  it('marks a binary file with an awkward name as binary', () => {
    write('image\n1.png', Buffer.from([0x00, 0x01, 0x02, 0xff]));

    const files = parseDiff(generateSyntheticDiffs(['image\n1.png'], root));

    expect(files).toHaveLength(1);
    expect(files[0].newPath).toBe('image\n1.png');
    expect(files[0].isBinary).toBe(true);
  });

  it('skips names that disappeared between listing and reading', () => {
    write('kept.txt', 'kept\n');

    const files = parseDiff(generateSyntheticDiffs(['kept.txt', 'gone.txt'], root));

    expect(files.map(file => file.newPath)).toEqual(['kept.txt']);
  });
});
