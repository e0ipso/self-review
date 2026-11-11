import { describe, expect, it } from 'vitest';
import { describeGitDiffSides } from './source-identity';
import { findUnsupportedGitDiffOptions, describeDiffPathRelativity } from './git-diff-args';
import { applyStagedUntrackedDefault } from './staged-untracked';
import { withParserCompatibleDiffArgs, PARSER_COMPATIBLE_DIFF_FLAGS } from './git';
import { DEFAULT_CONFIG } from '../../react/src/config-defaults';

describe('shared git argument interpretation', () => {
  it.each([
    ['-S', '--cached'],
    ['--', '--staged'],
    ['-pS', '--staged'],
  ])('keeps untracked defaults for option values and pathspecs %j', (...argv) => {
    expect(applyStagedUntrackedDefault(DEFAULT_CONFIG, argv).showUntracked).toBe(true);
  });

  it.each([
    ['-pR', 'HEAD'],
    ['-RW', 'HEAD'],
  ])('recognizes reverse inside %j', (...argv) => {
    expect(describeGitDiffSides(argv)).toEqual({
      oldSide: { kind: 'working-tree' },
      newSide: { kind: 'revision', rev: 'HEAD', implicit: false },
    });
  });

  it('does not let a separator-valued option hide the following revision', () => {
    expect(describeGitDiffSides(['-S', '--', 'HEAD'])).toEqual({
      oldSide: { kind: 'revision', rev: 'HEAD', implicit: false },
      newSide: { kind: 'working-tree' },
    });
    expect(describeDiffPathRelativity(['-S', '--', '--relative=sub'])).toEqual({
      kind: 'directory',
      directory: 'sub',
    });
  });

  it.each(['-ps', '-Rs'])('diagnoses suppressed patch output inside %s', arg => {
    expect(findUnsupportedGitDiffOptions([arg])).toEqual([arg]);
    expect(findUnsupportedGitDiffOptions(['-S', arg])).toEqual([]);
    expect(findUnsupportedGitDiffOptions([`-pS${arg}`])).toEqual([]);
  });

  it('inserts parser flags after a separator-valued option', () => {
    expect(withParserCompatibleDiffArgs(['-S', '--', 'HEAD'])).toEqual([
      '-S',
      '--',
      'HEAD',
      ...PARSER_COMPATIBLE_DIFF_FLAGS,
    ]);
  });
});
