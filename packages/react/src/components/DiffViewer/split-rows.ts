import type { DiffLine } from '@self-review/types';

interface SplitLineRow {
  oldLine: DiffLine | null;
  newLine: DiffLine | null;
}

/** Pure split alignment; callers memoize by the loaded hunk collection. */
export function buildSplitRows(lines: DiffLine[]): SplitLineRow[] {
  const rows: SplitLineRow[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.type === 'context') {
      rows.push({ oldLine: line, newLine: line });
      i++;
    } else if (line.type === 'deletion') {
      // Collect consecutive deletions
      const deletions: DiffLine[] = [];
      while (i < lines.length && lines[i].type === 'deletion') {
        deletions.push(lines[i]);
        i++;
      }
      // Collect consecutive additions that follow
      const additions: DiffLine[] = [];
      while (i < lines.length && lines[i].type === 'addition') {
        additions.push(lines[i]);
        i++;
      }
      // Zip deletions and additions into paired rows
      const maxLen = Math.max(deletions.length, additions.length);
      for (let j = 0; j < maxLen; j++) {
        rows.push({
          oldLine: j < deletions.length ? deletions[j] : null,
          newLine: j < additions.length ? additions[j] : null,
        });
      }
    } else if (line.type === 'addition') {
      rows.push({ oldLine: null, newLine: line });
      i++;
    } else {
      i++;
    }
  }

  return rows;
}
