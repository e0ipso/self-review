import type { DiffFile, LineRange } from '../../../shared/types';

/**
 * Extract the original code content for a given line range from a DiffFile.
 * Used to provide originalCode for the Suggest feature in both SplitView and UnifiedView.
 */
export function extractOriginalCode(
  file: DiffFile,
  lineRange: LineRange
): string | undefined {
  const { start, end, side } = lineRange;
  const lines: string[] = [];
  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      const lineNum =
        side === 'old' ? line.oldLineNumber : line.newLineNumber;
      if (lineNum !== null && lineNum >= start && lineNum <= end) {
        lines.push(line.content);
      }
    }
  }
  return lines.length > 0 ? lines.join('\n') : undefined;
}
