import type { DiffFile, DiffLine } from '@self-review/types';

export const HIGHLIGHT_MAX_LINE_CHARS = 2000;
export const HIGHLIGHT_MAX_FILE_CHARS = 100_000;
export const HIGHLIGHT_MAX_FILE_LINES = 1000;

/** Both diff layouts share one admission policy; skipped source always remains literal text. */
export function planHighlighting(file: DiffFile) {
  const lines = new WeakSet<DiffLine>();
  let chars = 0,
    count = 0,
    limited = false;
  for (const hunk of file.hunks)
    for (const line of hunk.lines) {
      if (
        line.content.length > HIGHLIGHT_MAX_LINE_CHARS ||
        chars + line.content.length > HIGHLIGHT_MAX_FILE_CHARS ||
        count >= HIGHLIGHT_MAX_FILE_LINES
      ) {
        limited = true;
        continue;
      }
      lines.add(line);
      chars += line.content.length;
      count++;
    }
  return { lines, limited };
}
