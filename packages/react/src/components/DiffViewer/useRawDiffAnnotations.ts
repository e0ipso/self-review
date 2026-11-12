import { useMemo } from 'react';
import type { DiffFile, LineRange, ReviewComment } from '@self-review/types';
import { useFileCommentIndex } from './useFileCommentIndex';
import { extractOriginalCode } from './diff-utils';
import { mergeLineComments } from './line-comments';

/** Source-derived feedback shared by raw layouts; row geometry remains layout-specific. */
export function useRawDiffAnnotations(file: DiffFile, range: LineRange | null) {
  const commentIndex = useFileCommentIndex(file);
  const originalCode = useMemo(
    () => (range ? extractOriginalCode(file, range) : undefined),
    [file, range]
  );
  const rowOffsets = useMemo(() => {
    let offset = 0;
    return file.hunks.map(hunk => {
      const start = offset;
      offset += hunk.lines.length;
      return start;
    });
  }, [file.hunks]);
  return {
    commentIndex,
    originalCode,
    rowOffsets,
    getOriginalCodeForComment: (comment: ReviewComment) =>
      comment.lineRange ? extractOriginalCode(file, comment.lineRange) : undefined,
    feedbackAt: (
      oldLine: number | null | undefined,
      newLine: number | null | undefined,
      firstSide: 'old' | 'new'
    ) => {
      const oldComments = commentIndex.endingAt(oldLine, 'old');
      const newComments = commentIndex.endingAt(newLine, 'new');
      return {
        comments:
          firstSide === 'old'
            ? mergeLineComments(oldComments, newComments)
            : mergeLineComments(newComments, oldComments),
        showInput: !!range && (range.side === 'old' ? oldLine : newLine) === range.end,
      };
    },
  };
}
