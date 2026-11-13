import type { DiffFile } from '@self-review/types';

/** Pure projection of added diff lines; preserves sparse and missing source numbers. */
interface AddedFileLine {
  lineNumber: number;
  content: string;
}

export function extractAddedFileLines(file: DiffFile): AddedFileLine[] {
  const lines: AddedFileLine[] = [];
  let fallbackLineNumber = 1;

  for (const hunk of file.hunks) {
    for (const line of hunk.lines) {
      if (line.type !== 'addition') continue;

      const lineNumber = line.newLineNumber ?? fallbackLineNumber;
      lines.push({ lineNumber, content: line.content });
      fallbackLineNumber = lineNumber + 1;
    }
  }

  return lines;
}

export function extractFileContent(lines: AddedFileLine[]): string {
  return lines.map(line => line.content).join('\n');
}

export function getAddedLineNumber(contentLineNumber: number, lines: AddedFileLine[]): number {
  return lines[contentLineNumber - 1]?.lineNumber ?? contentLineNumber;
}
