import { describe, it, expect } from 'vitest';
import {
  describeDiffPathRelativity,
  findUnsupportedGitDiffOptions,
  findWriteCapableGitDiffOptions,
  formatGitDiffArgs,
  normalizeGitDiffArgs,
  singleFileRediffArgs,
  tokenizeGitDiffArgs,
} from './git-diff-args';

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

// R06: unsupported output formats are named, not turned into an empty review.
describe('findUnsupportedGitDiffOptions', () => {
  it.each([
    ['--stat'],
    ['--stat=120'],
    ['--numstat'],
    ['--shortstat'],
    ['--dirstat'],
    ['--dirstat=lines'],
    ['--summary'],
    ['--name-only'],
    ['--name-status'],
    ['--raw'],
    ['--patch-with-stat'],
    ['--patch-with-raw'],
    ['--compact-summary'],
    ['--word-diff'],
    ['--word-diff=porcelain'],
    ['--color-words'],
    ['--color-words=.'],
    ['--color-moved'],
    ['--no-patch'],
    ['-s'],
    ['--exit-code'],
    ['--quiet'],
    ['--output=out.patch'],
    ['--line-prefix=> '],
  ])('names %s', flag => {
    expect(findUnsupportedGitDiffOptions(['--staged', flag, 'HEAD'])).toEqual([flag]);
  });

  it('names an option whose value is a separate argument by its spelling', () => {
    expect(findUnsupportedGitDiffOptions(['--output', 'out.patch'])).toEqual(['--output']);
    expect(findUnsupportedGitDiffOptions(['--word-diff-regex', '.'])).toEqual([
      '--word-diff-regex',
    ]);
  });

  it('accepts the options the parser consumes', () => {
    expect(
      findUnsupportedGitDiffOptions([
        '--staged',
        '-U5',
        '-M',
        '-C',
        '--find-copies-harder',
        '--binary',
        '--no-renames',
        '--diff-filter=AM',
        '-S',
        'needle',
        'main..feature',
      ])
    ).toEqual([]);
  });

  it('does not read an option value as a flag', () => {
    expect(findUnsupportedGitDiffOptions(['-S', '--stat', 'HEAD'])).toEqual([]);
  });

  it('does not read pathspecs after -- as flags', () => {
    expect(findUnsupportedGitDiffOptions(['HEAD', '--', '--stat'])).toEqual([]);
  });

  it('reports every offending flag in argument order', () => {
    expect(findUnsupportedGitDiffOptions(['--numstat', 'HEAD', '--name-only'])).toEqual([
      '--numstat',
      '--name-only',
    ]);
  });
});

describe('singleFileRediffArgs', () => {
  it('strips a bare -U without consuming the revision after it', () => {
    expect(singleFileRediffArgs(['-U', 'HEAD']).args).toEqual(['HEAD']);
    expect(singleFileRediffArgs(['--unified', 'HEAD']).args).toEqual(['HEAD']);
  });

  it('strips every spelling of the context size and function context', () => {
    const args = [
      '-U5',
      '--unified',
      '--unified=7',
      '-W',
      '--function-context',
      '--no-function-context',
      '--staged',
    ];
    expect(singleFileRediffArgs(args).args).toEqual(['--staged']);
  });

  it('strips context options out of short-option groups and keeps the rest', () => {
    expect(singleFileRediffArgs(['-RW', '-pU5', '-M50%']).args).toEqual(['-R', '-p', '-M50%']);
  });

  it('keeps an option value that is spelled like a context flag', () => {
    const args = ['-S', '-U', '-G', '--unified=3', '--staged'];
    expect(singleFileRediffArgs(args).args).toEqual(args);
  });

  it('drops file-ordering options, which fail when their file is not in the re-diff', () => {
    const args = ['-O', 'order.txt', '-ROorder', '--rotate-to', 'a', '--skip-to=b', 'HEAD'];
    expect(singleFileRediffArgs(args).args).toEqual(['-R', 'HEAD']);
  });

  it('drops the separator and the original pathspecs, including flag-like ones', () => {
    expect(singleFileRediffArgs(['main', 'feature', '--', 'src', '-U5']).args).toEqual([
      'main',
      'feature',
    ]);
  });

  it('reports what the output paths were relative to, and removes the option', () => {
    expect(singleFileRediffArgs(['HEAD'])).toEqual({ args: ['HEAD'], relative: { kind: 'root' } });
    expect(singleFileRediffArgs(['--relative', 'HEAD'])).toEqual({
      args: ['HEAD'],
      relative: { kind: 'cwd' },
    });
    expect(singleFileRediffArgs(['--relative', '--relative=sub/']).relative).toEqual({
      kind: 'directory',
      directory: 'sub/',
    });
    expect(singleFileRediffArgs(['--relative=sub', '--no-relative']).relative).toEqual({
      kind: 'root',
    });
    expect(singleFileRediffArgs(['--', '--relative']).relative).toEqual({ kind: 'root' });
  });
});

describe('describeDiffPathRelativity', () => {
  it('reports the last relative option before --, skipping option values', () => {
    expect(describeDiffPathRelativity(['HEAD'])).toEqual({ kind: 'root' });
    expect(describeDiffPathRelativity(['--relative', 'HEAD'])).toEqual({ kind: 'cwd' });
    expect(describeDiffPathRelativity(['--relative=sub/', '--relative'])).toEqual({ kind: 'cwd' });
    expect(describeDiffPathRelativity(['--relative', '--relative=sub'])).toEqual({
      kind: 'directory',
      directory: 'sub',
    });
    expect(describeDiffPathRelativity(['--relative=sub', '--no-relative'])).toEqual({
      kind: 'root',
    });
    expect(describeDiffPathRelativity(['-S', '--relative'])).toEqual({ kind: 'root' });
    expect(describeDiffPathRelativity(['--', '--relative'])).toEqual({ kind: 'root' });
  });
});

// Audit A5: options a committed configuration must not hand to git (git accepts no abbreviations).
describe('findWriteCapableGitDiffOptions', () => {
  it('names --output in both forms and the external-program options, in order', () => {
    expect(
      findWriteCapableGitDiffOptions([
        '--textconv',
        '--output=../x',
        '-p',
        '--output',
        'y',
        '--ext-diff',
      ])
    ).toEqual(['--textconv', '--output=../x', '--output', '--ext-diff']);
  });

  it('accepts the negations, ordinary options, option values and pathspecs', () => {
    expect(
      findWriteCapableGitDiffOptions([
        '--no-ext-diff',
        '--no-textconv',
        '--staged',
        '-S',
        '--output',
        '-O',
        '--ext-diff',
        '--',
        '--output',
      ])
    ).toEqual([]);
  });
});
