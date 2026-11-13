import { describe, expect, expectTypeOf, it } from 'vitest';
import * as legacy from './git-diff-args';
import {
  classifyGitDiffArgs,
  consumesNextArgument,
  describeDiffPathRelativity,
  findUnsupportedGitDiffOptions,
  findWriteCapableGitDiffOptions,
  parseGitDiffArgs,
  singleFileRediffArgs,
} from './git-argument-policy';
import type {
  DiffPathRelativity,
  GitDiffOption,
  ParsedGitDiffArgs,
  SingleFileRediff,
} from './git-diff-args';
import { normalizeGitDiffPaths } from './git-argument-paths';
import { formatGitDiffArgs, tokenizeGitDiffArgs } from './git-argument-text';

describe('pure argument policy', () => {
  it('probes only positional paths in order, keeping literal argv elements', () => {
    const probed: string[] = [];
    const args = ['-pS', '--', '--src-prefix', 'src', 'HEAD', 'literal "file"', '--textconv'];
    expect(
      normalizeGitDiffPaths(args, path => {
        probed.push(path);
        return path === 'literal "file"';
      })
    ).toEqual(['-pS', '--', '--src-prefix', 'src', 'HEAD', '--', 'literal "file"', '--textconv']);
    expect(probed).toEqual(['HEAD', 'literal "file"']);
    expect(args[5]).toBe('literal "file"');
  });

  it('never probes past an explicit separator or changes the unchanged array identity', () => {
    const args = ['--', '-S', '"unterminated', 'trailing\\'];
    expect(
      normalizeGitDiffPaths(args, () => {
        throw new Error('unexpected probe');
      })
    ).toBe(args);
    const revisions = ['main..topic'];
    expect(normalizeGitDiffPaths(revisions, () => false)).toBe(revisions);
  });

  it.each(['-U', '-M', '-B', '-C', '--relative', '--color', '--word-diff'])(
    'keeps a positional after the attached-only option %s',
    option => {
      expect(consumesNextArgument(option)).toBe(false);
      expect(classifyGitDiffArgs([option, 'HEAD']).positionalIndices).toEqual([1]);
    }
  );

  it('keeps aliases, negations, unknown flags and duplicate ordering', () => {
    const args = [
      '--cached',
      '--staged',
      '--future-option',
      '--no-textconv',
      '--no-ext-diff',
      '-R',
      '-R',
      'HEAD',
    ];
    expect(singleFileRediffArgs(args).args).toEqual(args);
    expect(findWriteCapableGitDiffOptions(args)).toEqual([]);
    expect(findUnsupportedGitDiffOptions(args)).toEqual([]);
    expect(parseGitDiffArgs(args).positionalIndices).toEqual([7]);
  });

  it('shares grouped arity with diagnostics, relative paths and rediff filtering', () => {
    const args = [
      '-RWpS',
      '--',
      '--relative=sub/',
      '--src-prefix',
      'a b/',
      '--dst-prefix=z/',
      '-RO',
      'order',
      '-pU3',
      'HEAD',
      '--',
      '--quiet',
    ];
    expect(parseGitDiffArgs(args).separatorIndex).toBe(10);
    expect(describeDiffPathRelativity(args)).toEqual({ kind: 'directory', directory: 'sub/' });
    expect(singleFileRediffArgs(args)).toEqual({
      args: ['-RpS', '--', '--src-prefix', 'a b/', '--dst-prefix=z/', '-R', '-p', 'HEAD'],
      relative: { kind: 'directory', directory: 'sub/' },
    });
    expect(findUnsupportedGitDiffOptions(args)).toEqual([]);
  });

  it('retains warnings as written, including duplicates and attached stat parameters', () => {
    const args = [
      '--stat',
      '--stat-width=80',
      '--stat-width',
      '90',
      '-ps',
      '--stat',
      '--output',
      '--',
      'HEAD',
    ];
    expect(findUnsupportedGitDiffOptions(args)).toEqual([
      '--stat',
      '--stat-width=80',
      '-ps',
      '--stat',
      '--output',
    ]);
    expect(findWriteCapableGitDiffOptions(args)).toEqual(['--output']);
    expect(parseGitDiffArgs(args).separatorIndex).toBeNull();
    expect(
      findUnsupportedGitDiffOptions(['--future=--stat', '-S--output', '--', '--output'])
    ).toEqual([]);
  });

  it('preserves tolerant malformed text and exact Unicode/empty/literal argv round trips', () => {
    expect(tokenizeGitDiffArgs('"open')).toEqual(['open']);
    expect(tokenizeGitDiffArgs("'open")).toEqual(['open']);
    expect(tokenizeGitDiffArgs('tail\\')).toEqual(['tail\\']);
    const args = ['雪😀', '', 'a\nb', '\'"\\', '$(literal)', '--', '"unterminated', 'trailing\\'];
    expect(tokenizeGitDiffArgs(formatGitDiffArgs(args))).toEqual(args);
  });

  it('preserves legacy exports, signatures and required/optional property shapes', () => {
    expect(legacy.parseGitDiffArgs).toBe(parseGitDiffArgs);
    expect(legacy.tokenizeGitDiffArgs).toBe(tokenizeGitDiffArgs);
    expect(legacy.formatGitDiffArgs).toBe(formatGitDiffArgs);
    expectTypeOf(legacy.normalizeGitDiffArgs).toEqualTypeOf<
      (args: string[], cwd?: string) => string[]
    >();
    expectTypeOf(legacy.parseGitDiffArgs).toEqualTypeOf<
      (args: readonly string[]) => ParsedGitDiffArgs
    >();
    expectTypeOf(legacy.singleFileRediffArgs).toEqualTypeOf<
      (args: readonly string[]) => SingleFileRediff
    >();
    expectTypeOf<GitDiffOption>().toEqualTypeOf<{
      index: number;
      arg: string;
      name: string;
      value?: string;
    }>();
    expectTypeOf<ParsedGitDiffArgs>().toEqualTypeOf<{
      options: GitDiffOption[];
      positionalIndices: number[];
      separatorIndex: number | null;
    }>();
    expectTypeOf<DiffPathRelativity>().toEqualTypeOf<
      { kind: 'root' } | { kind: 'cwd' } | { kind: 'directory'; directory: string }
    >();
  });
});
