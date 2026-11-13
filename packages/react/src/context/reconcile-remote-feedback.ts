import type { DiffFile, FileReviewState, LineRange, ReviewComment } from '@self-review/types';

function indexed(files: DiffFile[]) {
  const byPath = new Map<string, DiffFile>();
  for (const file of files) {
    const path = file.newPath || file.oldPath;
    if (!byPath.has(path)) byPath.set(path, file);
  }
  return byPath;
}

/** A gap, invalid range, binary file or unloaded hunk cannot prove an anchor survived. */
function anchoredText(file: DiffFile | undefined, range: LineRange): string | null {
  if (!file || file.isBinary || file.contentLoaded === false || file.omittedReason) return null;
  if (
    !Number.isSafeInteger(range.start) ||
    !Number.isSafeInteger(range.end) ||
    range.start < 1 ||
    range.end < range.start
  )
    return null;
  const lines = new Map<number, string>();
  for (const hunk of file.hunks)
    for (const line of hunk.lines) {
      const number = range.side === 'old' ? line.oldLineNumber : line.newLineNumber;
      if (number === null || number < range.start || number > range.end) continue;
      if (range.side === 'old' ? line.type !== 'deletion' : line.type === 'deletion') continue;
      if (lines.has(number) && lines.get(number) !== line.content) return null;
      lines.set(number, line.content);
    }
  if (lines.size !== range.end - range.start + 1) return null;
  return Array.from({ length: lines.size }, (_, offset) => lines.get(range.start + offset)!).join(
    '\n'
  );
}

function withoutAnchor(comment: ReviewComment): ReviewComment {
  let body = comment.body;
  if (comment.suggestion) {
    const quoted = (text: string) =>
      text
        .split('\n')
        .map(line => `    ${line}`)
        .join('\n');
    body += `\n\nSuggestion from the previous snapshot, kept as text because its anchor could not be verified.\n\nOriginal code:\n\n${quoted(comment.suggestion.originalCode)}\n\nProposed code:\n\n${quoted(comment.suggestion.proposedCode)}`;
  }
  return { ...comment, body, lineRange: null, suggestion: null, orphaned: true };
}

/** Never search for a matching line elsewhere. Keep an anchor only at the exact same path,
 * side and range with identical text in both snapshots. Unknown anchors become visible,
 * file-level feedback, preserving proposals as inert text and all thread metadata.
 */
export function reconcileRemoteFeedback(
  files: FileReviewState[],
  previous: DiffFile[],
  next: DiffFile[]
): { files: FileReviewState[]; diagnostics: string[] } {
  const before = indexed(previous);
  const after = indexed(next);
  const diagnostics: string[] = [];
  const reconciled = files.map(file => {
    let changed = false;
    const comments = file.comments.map(comment => {
      if (!comment.lineRange && !comment.suggestion) return comment;
      const oldFile = before.get(file.path);
      const newFile = after.get(file.path);
      const original = comment.lineRange ? anchoredText(oldFile, comment.lineRange) : null;
      const retained = comment.lineRange ? anchoredText(newFile, comment.lineRange) : null;
      if (
        oldFile &&
        newFile &&
        oldFile.oldPath === newFile.oldPath &&
        oldFile.newPath === newFile.newPath &&
        oldFile.changeType === newFile.changeType &&
        original !== null &&
        original === retained &&
        (!comment.suggestion || comment.suggestion.originalCode === original)
      )
        return comment;
      changed = true;
      diagnostics.push(
        `${file.path}: comment ${comment.id} anchor could not be verified in the new remote snapshot; kept as file-level feedback`
      );
      return withoutAnchor(comment);
    });
    return changed ? { ...file, comments } : file;
  });
  return {
    files: reconciled.every((file, index) => file === files[index]) ? files : reconciled,
    diagnostics,
  };
}
