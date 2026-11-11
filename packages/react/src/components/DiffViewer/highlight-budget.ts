import type { DiffFile, DiffLine } from '@self-review/types';

export const HIGHLIGHT_MAX_LINE_CHARS = 2000;
export const HIGHLIGHT_MAX_FILE_CHARS = 100_000;
export const HIGHLIGHT_MAX_FILE_LINES = 1000;

/** One deterministic work budget for a diff file or both sides of a suggestion. */
export function createHighlightBudget() {
  let chars = 0,
    count = 0,
    limited = false;
  return {
    get limited() {
      return limited;
    },
    admit(content: string) {
      if (
        content.length > HIGHLIGHT_MAX_LINE_CHARS ||
        chars + content.length > HIGHLIGHT_MAX_FILE_CHARS ||
        count >= HIGHLIGHT_MAX_FILE_LINES
      ) {
        limited = true;
        return false;
      }
      chars += content.length;
      count++;
      return true;
    },
  };
}

/** Both diff layouts share one admission policy; skipped source always remains literal text. */
export function planHighlighting(file: DiffFile) {
  const lines = new WeakSet<DiffLine>();
  const budget = createHighlightBudget();
  for (const hunk of file.hunks)
    for (const line of hunk.lines) {
      if (budget.admit(line.content)) lines.add(line);
    }
  return { lines, limited: budget.limited };
}
