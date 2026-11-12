// Patch bytes and structured additions are alternative emitters selected once per projection.
import type { DiffFile, DiffLine } from './types';
import { quoteGitPath } from './git-path-quote';
import type { EmittedSource } from './synthetic-accounting';
import type { ProjectedText } from './synthetic-text';

export function* projectedLines(
  text: ProjectedText
): Generator<{ content: string; number: number }> {
  let start = 0;
  for (let index = 0; index < text.lineCount; index++) {
    const end = text.text.indexOf('\n', start);
    const content = text.text.slice(start, end === -1 ? undefined : end);
    start = end + 1;
    yield { content, number: index + 1 };
  }
}

export function createFilesEmitter() {
  const files: DiffFile[] = [];
  return {
    *emit(
      filePath: string,
      source?: EmittedSource,
      text?: ProjectedText,
      _mode?: string
    ): Generator<void> {
      const lines: DiffLine[] = [];
      if (text) {
        for (const line of projectedLines(text)) {
          lines.push({
            type: 'addition',
            oldLineNumber: null,
            newLineNumber: line.number,
            content: line.content,
          });
          if (line.number % 256 === 0) yield;
        }
      }
      files.push({
        oldPath: '',
        newPath: filePath,
        changeType: 'added',
        isBinary: source?.kind === 'binary',
        hunks: text
          ? [
              {
                header: text.header,
                oldStart: 0,
                oldLines: 0,
                newStart: 1,
                newLines: text.lineCount,
                lines,
              },
            ]
          : [],
      });
    },
    finish: () => ({ diff: '', files }),
  };
}

export function createPatchEmitter() {
  const diffs: string[] = [];
  return {
    *emit(
      filePath: string,
      source?: EmittedSource,
      text?: ProjectedText,
      mode = source?.kind === 'symlink' ? '120000' : '100644'
    ): Generator<void> {
      const patch: string[] = [];
      if (text) {
        for (const line of projectedLines(text)) {
          patch.push(`+${line.content}`);
          if (line.number % 256 === 0) yield;
        }
      }
      const oldHeaderPath = quoteGitPath(`a/${filePath}`);
      const newHeaderPath = quoteGitPath(`b/${filePath}`);
      const header = `diff --git ${oldHeaderPath} ${newHeaderPath}\nnew file mode ${mode}`;
      diffs.push(
        text
          ? `${header}\n--- /dev/null\n+++ ${newHeaderPath}\n${text.header}\n` +
              patch.join('\n') +
              (text.missingNewline ? '\n\\ No newline at end of file' : '')
          : source?.kind === 'binary'
            ? `${header}\nBinary files /dev/null and ${newHeaderPath} differ`
            : header
      );
    },
    finish: () => ({ diff: diffs.join('\n'), files: [] as DiffFile[] }),
  };
}
