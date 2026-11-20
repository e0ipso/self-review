// Diff sizes for the resolve report and the summary table.

import { gitValue } from './git';

export interface DiffSize {
  files: number;
  insertions: number;
  deletions: number;
}

/** `git diff --shortstat` between two trees or commits, optionally limited to pathspecs. */
export function shortstat(from: string, to: string, paths: readonly string[] = []): DiffSize {
  const text = gitValue([
    '-c',
    'diff.relative=false',
    'diff',
    '--shortstat',
    from,
    to,
    '--',
    ...paths,
  ]);
  const count = (kind: string): number => {
    const match = new RegExp(`(\\d+) ${kind}`).exec(text);
    return match ? Number(match[1]) : 0;
  };
  return { files: count('file'), insertions: count('insertion'), deletions: count('deletion') };
}

/** `3 files changed +10 -2` */
export function diffstat({ files, insertions, deletions }: DiffSize): string {
  return `${files} file${files === 1 ? '' : 's'} changed +${insertions} -${deletions}`;
}
