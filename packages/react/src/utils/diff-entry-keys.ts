import type { DiffFile } from '@self-review/types';
import type { GuideDisplaySection } from './guide-display';

/** UI identity only: path-based comments, viewed state and public lookup remain grouped.
 * Count occurrences before filtering so searches retain surviving entries' component state.
 */
export function keyDiffEntries(files: DiffFile[], sections: GuideDisplaySection[]) {
  const counts = new Map<string, number>();
  const keys = new Map<DiffFile, string[]>();
  for (const file of files) {
    const signature = JSON.stringify([file.oldPath, file.newPath, file.changeType]);
    const occurrence = counts.get(signature) ?? 0;
    counts.set(signature, occurrence + 1);
    const entryKeys = keys.get(file) ?? [];
    entryKeys.push(`${signature}:${occurrence}`);
    keys.set(file, entryKeys);
  }
  const used = new Map<DiffFile, number>();
  return sections.map(section => ({
    ...section,
    entries: section.entries.map(entry => {
      const occurrence = used.get(entry.file) ?? 0;
      used.set(entry.file, occurrence + 1);
      return { ...entry, key: keys.get(entry.file)![occurrence] };
    }),
  }));
}
