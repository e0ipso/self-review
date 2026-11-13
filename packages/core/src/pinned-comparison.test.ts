import { describe, expect, it } from 'vitest';
import type { ReviewSourceIdentity } from './types';
import { pinnedGitDiffArgs, UnresolvedComparisonError } from './pinned-comparison';

const oldSha = '1'.repeat(40);
const newSha = '2'.repeat(40);
const identity = (
  argv: string[],
  sides: Pick<ReviewSourceIdentity, 'oldSide' | 'newSide'>
): ReviewSourceIdentity => ({
  mode: 'git',
  sourceRoot: '/repo',
  invocationCwd: '/repo',
  gitDiffArgv: argv,
  pathPrefix: '',
  ...sides,
});
const oldCommit = { kind: 'commit', sha: oldSha } as const;
const newCommit = { kind: 'commit', sha: newSha } as const;

describe('pinned comparison execution', () => {
  it.each([
    [
      ['main..topic', '--', 'a.txt'],
      [oldSha, newSha, '--', 'a.txt'],
    ],
    [
      ['--merge-base', 'main', 'topic'],
      [oldSha, newSha],
    ],
    [['main...topic'], [oldSha, newSha]],
    [
      ['-S', '--', 'main', 'topic'],
      ['-S', '--', oldSha, newSha],
    ],
  ])('uses resolved commits while retaining flags and pathspecs %j', (argv, expected) => {
    const source = identity(argv, { oldSide: oldCommit, newSide: newCommit });
    expect(pinnedGitDiffArgs(source)).toEqual(expected);
    expect(source.gitDiffArgv).toEqual(argv);
  });

  it('retains grouped reverse flags without swapping the pins twice', () => {
    expect(
      pinnedGitDiffArgs(
        identity(['-pR', 'main'], {
          oldSide: { kind: 'working-tree' },
          newSide: oldCommit,
        })
      )
    ).toEqual(['-pR', oldSha]);
  });

  it('pins the implicit HEAD of staged reviews', () => {
    expect(
      pinnedGitDiffArgs(
        identity(['--cached'], {
          oldSide: oldCommit,
          newSide: { kind: 'index' },
        })
      )
    ).toEqual(['--cached', oldSha]);
  });

  it('refuses a supported but unresolved revision', () => {
    expect(() =>
      pinnedGitDiffArgs(
        identity(['missing'], {
          oldSide: { kind: 'unknown', reason: 'missing does not name a commit' },
          newSide: { kind: 'working-tree' },
        })
      )
    ).toThrow(UnresolvedComparisonError);
  });

  it('leaves unsupported shapes available for the parser to diagnose', () => {
    const argv = ['one', 'two', 'three'];
    expect(
      pinnedGitDiffArgs(
        identity(argv, {
          oldSide: { kind: 'unknown', reason: 'combined' },
          newSide: { kind: 'unknown', reason: 'combined' },
        })
      )
    ).toEqual(argv);
  });
});
