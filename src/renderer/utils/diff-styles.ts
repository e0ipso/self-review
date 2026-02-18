import type { DiffFile, DiffLine } from '../../shared/types';

export function getLineBg(line: DiffLine | null): string {
  if (!line) return '';
  if (line.type === 'addition')
    return 'bg-emerald-50/70 dark:bg-emerald-900/40';
  if (line.type === 'deletion') return 'bg-red-50/70 dark:bg-red-900/40';
  return '';
}

export function getGutterBg(line: DiffLine | null): string {
  if (!line) return 'bg-muted/30';
  if (line.type === 'addition')
    return 'bg-emerald-100/80 dark:bg-emerald-900/50';
  if (line.type === 'deletion') return 'bg-red-100/80 dark:bg-red-900/50';
  return 'bg-muted/30';
}

export function getFileStats(file: DiffFile): { additions: number; deletions: number } {
  let additions = 0;
  let deletions = 0;
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type === 'addition') additions++;
      if (line.type === 'deletion') deletions++;
    }
  }
  return { additions, deletions };
}

export function getChangeTypeInfo(
  changeType: DiffFile['changeType']
): { label: string; className: string } {
  switch (changeType) {
    case 'added':
      return { label: 'A', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' };
    case 'modified':
      return { label: 'M', className: 'bg-amber-500/15 text-amber-700 dark:text-amber-400' };
    case 'deleted':
      return { label: 'D', className: 'bg-red-500/15 text-red-700 dark:text-red-400' };
    case 'renamed':
      return { label: 'R', className: 'bg-blue-500/15 text-blue-700 dark:text-blue-400' };
    default:
      return { label: '?', className: '' };
  }
}
