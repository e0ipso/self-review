import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { InlineCommentSlot } from './InlineCommentSlot';
import type { ReviewComment } from '@self-review/types';

vi.mock('../Comments/CommentDisplay', () => ({
  default: ({ comment }: { comment: ReviewComment }) => (
    <div data-testid={`comment-${comment.id}`}>{comment.body}</div>
  ),
}));

vi.mock('../Comments/CommentInput', () => ({
  default: ({ filePath }: { filePath: string }) => (
    <div data-testid='comment-input' data-file-path={filePath} />
  ),
}));

function makeComment(id: string): ReviewComment {
  return {
    id,
    filePath: 'src/foo.ts',
    body: `Comment ${id}`,
    category: 'general',
    lineRange: { side: 'new', start: 1, end: 1 },
    suggestion: null,
    createdAt: new Date().toISOString(),
  };
}

describe('InlineCommentSlot', () => {
  it('renders nothing when no comments and no input', () => {
    const { container } = render(
      <InlineCommentSlot
        commentsToRender={[]}
        showCommentInput={false}
        commentRange={null}
        filePath='src/foo.ts'
        originalCode={undefined}
        onCancel={() => {}}
        onSaved={() => {}}
      />
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders existing comments', () => {
    const comments = [makeComment('a'), makeComment('b')];
    const { getByTestId } = render(
      <InlineCommentSlot
        commentsToRender={comments}
        showCommentInput={false}
        commentRange={null}
        filePath='src/foo.ts'
        originalCode={undefined}
        onCancel={() => {}}
        onSaved={() => {}}
      />
    );
    expect(getByTestId('comment-a')).toBeTruthy();
    expect(getByTestId('comment-b')).toBeTruthy();
  });

  it('renders CommentInput when showCommentInput is true', () => {
    const { getByTestId } = render(
      <InlineCommentSlot
        commentsToRender={[]}
        showCommentInput={true}
        commentRange={{ start: 5, end: 5, side: 'new' }}
        filePath='src/foo.ts'
        originalCode={undefined}
        onCancel={() => {}}
        onSaved={() => {}}
      />
    );
    expect(getByTestId('comment-input')).toBeTruthy();
  });

  it('applies indentClass to both comment and input wrappers', () => {
    const comments = [makeComment('c')];
    const { container } = render(
      <InlineCommentSlot
        commentsToRender={comments}
        showCommentInput={true}
        commentRange={{ start: 1, end: 1, side: 'new' }}
        filePath='src/foo.ts'
        originalCode={undefined}
        onCancel={() => {}}
        onSaved={() => {}}
        indentClass='ml-[100px]'
      />
    );
    const divs = container.querySelectorAll('.ml-\\[100px\\]');
    expect(divs.length).toBeGreaterThan(0);
  });
});
