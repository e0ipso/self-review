import { useLocalization } from '../../localization/LocalizationContext';
import React, { useMemo } from 'react';
import type { DiffFile, ReviewComment } from '@self-review/types';
import { createCommentAnchorMatcher } from '../../utils/comment-anchors';
import { useFileReview } from '../../context/ReviewContext';
import CommentInput from '../Comments/CommentInput';
import CommentDisplay from '../Comments/CommentDisplay';
import { extractOriginalCode } from './diff-utils';
import { parseFrontMatter } from '../../utils/front-matter';
import { ReviewedMedia } from '../ReviewedMedia/ReviewedImage';
import FrontMatterTable from './FrontMatterTable';
import type { RenderedTextMode } from '../../utils/file-type-utils';
import { extractAddedFileLines, extractFileContent, getAddedLineNumber } from './rendered-source';
import { PositionedTextContent, type RenderedBlockContextValue } from './PositionedTextContent';

const NO_COMMENTS: ReviewComment[] = [];

export interface RenderedMarkdownViewProps {
  file: DiffFile;
  contentMode: RenderedTextMode;
  commentRange: { start: number; end: number; side: 'old' | 'new' } | null;
  onCancelComment: () => void;
  onCommentSaved: () => void;
  onGutterMouseDown: (startLine: number, endLine: number) => void;
}

export default function RenderedMarkdownView({
  file,
  contentMode,
  commentRange,
  onCancelComment,
  onCommentSaved,
  onGutterMouseDown,
}: RenderedMarkdownViewProps) {
  const { t } = useLocalization();
  const addedLines = useMemo(() => extractAddedFileLines(file), [file]);
  const content = useMemo(() => extractFileContent(addedLines), [addedLines]);
  const frontMatter = useMemo(
    () => (contentMode === 'markdown' ? parseFrontMatter(content) : null),
    [content, contentMode]
  );
  const markdownBody = frontMatter ? frontMatter.body : content;
  const lineOffset = frontMatter ? frontMatter.lineOffset : 0;
  const filePath = file.newPath || file.oldPath;
  const fileComments = useFileReview(filePath)?.comments ?? NO_COMMENTS;
  const hasAnchor = useMemo(() => createCommentAnchorMatcher(file), [file]);
  const comments = useMemo(
    () => fileComments.filter(comment => comment.lineRange !== null && hasAnchor(comment)),
    [fileComments, hasAnchor]
  );

  const resolveLine = useMemo(
    () => (sourceLine: number) => getAddedLineNumber(sourceLine + lineOffset, addedLines),
    [addedLines, lineOffset]
  );

  const blockContext = useMemo<RenderedBlockContextValue>(
    () => ({ commentRange, resolveLine, onGutterMouseDown }),
    [commentRange, resolveLine, onGutterMouseDown]
  );

  return (
    <>
      <div
        className='prose dark:prose-invert max-w-none p-4 rendered-markdown-view'
        data-rendered-text-mode={contentMode}
      >
        {frontMatter && <FrontMatterTable metadata={frontMatter.metadata} />}
        <ReviewedMedia documentPath={filePath}>
          <PositionedTextContent
            content={markdownBody}
            contentMode={contentMode}
            context={blockContext}
          />
        </ReviewedMedia>
      </div>
      {(comments.length > 0 || commentRange) && (
        <section
          aria-label={t('Comments on source lines')}
          className='space-y-3 border-t border-border bg-muted/30 p-4'
        >
          {comments.map(comment => {
            const visibleCode = comment.lineRange
              ? extractOriginalCode(file, comment.lineRange)
              : undefined;
            return (
              <div key={comment.id}>
                <p className='mb-1 text-xs text-muted-foreground'>
                  {comment.lineRange?.start === comment.lineRange?.end
                    ? t('Line {line}', { line: comment.lineRange!.start })
                    : t('Lines {start} to {end}', {
                        start: comment.lineRange!.start,
                        end: comment.lineRange!.end,
                      })}
                </p>
                <CommentDisplay
                  comment={comment}
                  originalCode={visibleCode}
                  anchorFullyVisible={visibleCode !== undefined}
                />
              </div>
            );
          })}
          {commentRange && (
            <CommentInput
              filePath={filePath}
              lineRange={commentRange}
              onCancel={onCancelComment}
              onSubmit={onCommentSaved}
              originalCode={extractOriginalCode(file, commentRange)}
            />
          )}
        </section>
      )}
    </>
  );
}
