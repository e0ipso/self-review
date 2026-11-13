import type { DiffFile } from '@self-review/types';

/** Counts entries, including duplicate paths. Missing legacy flags mean the supplied hunks
 * are complete; explicitly unloaded text or omitted content cannot supply review totals.
 * Binary entries have no text line counts and do not wait for lazy hunk loading.
 */
export function diffTotals(files: DiffFile[]) {
  let additions = 0;
  let deletions = 0;
  const complete = files.every(
    file => !file.omittedReason && (file.isBinary || file.contentLoaded !== false)
  );
  if (complete) {
    for (const file of files) {
      if (file.isBinary) continue;
      for (const hunk of file.hunks) {
        for (const line of hunk.lines) {
          if (line.type === 'addition') additions++;
          else if (line.type === 'deletion') deletions++;
        }
      }
    }
  }
  return { files: files.length, complete, additions, deletions };
}
