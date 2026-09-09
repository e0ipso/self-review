import { describe, it, expect } from 'vitest';
import { formatGitDiffArgs, normalizeGitDiffArgs, tokenizeGitDiffArgs } from './git-diff-args';

describe('normalizeGitDiffArgs', () => {
  it('returns unchanged when no positional path args', () => {
    const args = ['--staged', '--ignore-space-change'];
    expect(normalizeGitDiffArgs(args, '/nonexistent')).toEqual(args);
  });

  it('returns unchanged for revision-style args', () => {
    const args = ['main..feature'];
    // 'main..feature' won't exist on the filesystem
    expect(normalizeGitDiffArgs(args, '/nonexistent')).toEqual(args);
  });

  it('inserts -- before an existing path arg', () => {
    // Use a directory that definitely exists
    const args = ['src'];
    const result = normalizeGitDiffArgs(args, process.cwd());
    expect(result).toEqual(['--', 'src']);
  });

  it('preserves flags before the path arg', () => {
    const args = ['--staged', 'src'];
    const result = normalizeGitDiffArgs(args, process.cwd());
    expect(result).toEqual(['--staged', '--', 'src']);
  });

  it('returns unchanged when -- is already present (idempotent)', () => {
    const args = ['--staged', '--', 'src'];
    expect(normalizeGitDiffArgs(args, process.cwd())).toEqual(args);
  });

  it('returns unchanged for empty array', () => {
    expect(normalizeGitDiffArgs([], process.cwd())).toEqual([]);
  });
});

describe('tokenizeGitDiffArgs', () => {
  it('splits on whitespace when nothing is quoted', () => {
    expect(tokenizeGitDiffArgs('--staged --ignore-space-change')).toEqual([
      '--staged',
      '--ignore-space-change',
    ]);
  });

  it('collapses runs of whitespace and ignores padding', () => {
    expect(tokenizeGitDiffArgs('  --staged \t main..feature  ')).toEqual([
      '--staged',
      'main..feature',
    ]);
  });

  it('returns nothing for an empty or blank string', () => {
    expect(tokenizeGitDiffArgs('')).toEqual([]);
    expect(tokenizeGitDiffArgs('   ')).toEqual([]);
  });

  it('keeps a double-quoted filename as one argument', () => {
    expect(tokenizeGitDiffArgs('--staged -- "my file.txt"')).toEqual([
      '--staged',
      '--',
      'my file.txt',
    ]);
  });

  it('keeps a single-quoted search string as one argument', () => {
    expect(tokenizeGitDiffArgs("-S 'foo bar' main..feature")).toEqual([
      '-S',
      'foo bar',
      'main..feature',
    ]);
  });

  it('joins a quoted run to the text touching it', () => {
    expect(tokenizeGitDiffArgs('--output-indicator-new="+"')).toEqual(['--output-indicator-new=+']);
  });

  it('honours a backslash escape outside quotes', () => {
    expect(tokenizeGitDiffArgs('-- my\\ file.txt')).toEqual(['--', 'my file.txt']);
  });

  it('unescapes only the quote and the backslash inside double quotes', () => {
    expect(tokenizeGitDiffArgs('"a\\"b" "c\\d"')).toEqual(['a"b', 'c\\d']);
  });

  it('takes single-quoted content literally', () => {
    expect(tokenizeGitDiffArgs(`-S '\\n\\t"x"'`)).toEqual(['-S', '\\n\\t"x"']);
  });

  it('closes an unterminated quote at end of input instead of throwing', () => {
    expect(tokenizeGitDiffArgs('-- "my file')).toEqual(['--', 'my file']);
  });

  it('keeps an empty quoted argument', () => {
    expect(tokenizeGitDiffArgs("--src-prefix ''")).toEqual(['--src-prefix', '']);
  });
});

describe('formatGitDiffArgs', () => {
  it('writes ordinary arguments bare, exactly as a join would', () => {
    const args = ['--staged', '--', 'src/app.ts'];
    expect(formatGitDiffArgs(args)).toBe(args.join(' '));
  });

  it('quotes an argument containing whitespace', () => {
    expect(formatGitDiffArgs(['-S', 'foo bar'])).toBe("-S 'foo bar'");
  });

  it('quotes an empty argument so it survives', () => {
    expect(formatGitDiffArgs(['--src-prefix', ''])).toBe("--src-prefix ''");
  });

  it('escapes an embedded single quote', () => {
    expect(formatGitDiffArgs(["it's here"])).toBe("'it'\\''s here'");
  });

  it('round-trips every argument through tokenizeGitDiffArgs', () => {
    const cases = [
      ['--staged', '--', 'src/app.ts'],
      ['-S', 'foo bar', 'main..feature'],
      ['--', 'my file.txt', "it's a file.txt"],
      ['--src-prefix', '', 'a"b', 'back\\slash'],
    ];
    for (const args of cases) {
      expect(tokenizeGitDiffArgs(formatGitDiffArgs(args))).toEqual(args);
    }
  });
});
