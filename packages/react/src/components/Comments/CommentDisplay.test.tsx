import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, within } from '@testing-library/react';
import type { ReviewComment, Reply } from '@self-review/types';
import CommentDisplay from './CommentDisplay';

const mocks = vi.hoisted(() => ({
  deleteComment: vi.fn(),
  deleteReply: vi.fn(),
}));

vi.mock('../../context/ReviewContext', () => ({
  useReview: () => ({
    deleteComment: mocks.deleteComment,
    deleteReply: mocks.deleteReply,
  }),
}));

vi.mock('../../context/ConfigContext', () => ({
  useConfig: () => ({ config: { categories: [] } }),
}));

vi.mock('./CommentInput', () => ({
  default: () => <div data-testid='comment-input' />,
}));

// Stubbed to keep the MDEditor stack out of this test. The prop surface is
// asserted through the data attributes below.
vi.mock('./ReplyInput', () => ({
  default: ({
    commentId,
    existingReply,
    onCancel,
  }: {
    commentId: string;
    existingReply?: Reply;
    onCancel: () => void;
  }) => (
    <div
      data-testid='reply-input'
      data-comment-id={commentId}
      data-existing-reply-id={existingReply?.id ?? ''}
    >
      <button data-testid='stub-cancel-reply' onClick={onCancel}>
        cancel
      </button>
    </div>
  ),
}));

function makeComment(overrides: Partial<ReviewComment> = {}): ReviewComment {
  return {
    id: 'c1',
    filePath: 'src/foo.ts',
    lineRange: { side: 'new', start: 3, end: 3 },
    body: 'Root finding',
    category: 'bug',
    suggestion: null,
    ...overrides,
  };
}

const replies: Reply[] = [
  { id: 'r1', body: 'First turn', author: 'claude-opus-5' },
  { id: 'r2', body: 'Second turn' },
  { id: 'r3', body: 'Third turn', author: 'gpt' },
];

describe('CommentDisplay threads', () => {
  beforeEach(() => {
    mocks.deleteComment.mockReset();
    mocks.deleteReply.mockReset();
  });

  it('renders replies as direct children of the thread, in array order', () => {
    const { getByTestId, container } = render(
      <CommentDisplay comment={makeComment({ replies })} />
    );

    const thread = getByTestId('thread-c1');
    expect(thread).toBeTruthy();

    const rendered = Array.from(
      container.querySelectorAll(
        '[data-testid^="thread-"] > [data-testid^="reply-"]'
      )
    ).map((el) => el.getAttribute('data-testid'));
    expect(rendered).toEqual(['reply-r1', 'reply-r2', 'reply-r3']);

    expect(within(thread).getByTestId('reply-r1').textContent).toContain(
      'First turn'
    );
  });

  it('attributes authored replies to their author and unauthored ones to "You"', () => {
    const { getByTestId } = render(
      <CommentDisplay comment={makeComment({ replies })} />
    );

    expect(getByTestId('reply-r1').textContent).toContain('claude-opus-5');
    expect(getByTestId('reply-r2').textContent).toContain('You');
    expect(getByTestId('reply-r2').textContent).not.toContain('claude-opus-5');
  });

  it('renders no thread container when the comment has no replies', () => {
    const { queryByTestId } = render(<CommentDisplay comment={makeComment()} />);
    expect(queryByTestId('thread-c1')).toBeNull();
  });

  it.each([
    ['authored', 'claude-opus-5'],
    ['unauthored', undefined],
  ])('offers Reply on an %s comment', (_label, author) => {
    const { getByTestId } = render(
      <CommentDisplay comment={makeComment({ author })} />
    );
    expect(getByTestId('reply-btn-c1')).toBeTruthy();
  });

  it('mounts the reply composer on Reply and unmounts it on Cancel', () => {
    const { getByTestId, queryByTestId } = render(
      <CommentDisplay comment={makeComment()} />
    );

    expect(queryByTestId('reply-input')).toBeNull();
    fireEvent.click(getByTestId('reply-btn-c1'));

    const input = getByTestId('reply-input');
    expect(input.getAttribute('data-comment-id')).toBe('c1');
    expect(input.getAttribute('data-existing-reply-id')).toBe('');
    expect(queryByTestId('reply-btn-c1')).toBeNull();

    fireEvent.click(getByTestId('stub-cancel-reply'));
    expect(queryByTestId('reply-input')).toBeNull();
    expect(getByTestId('reply-btn-c1')).toBeTruthy();
  });

  it('swaps a reply for a prefilled composer on Edit, with no author gating', () => {
    const { getByTestId, queryByTestId } = render(
      <CommentDisplay comment={makeComment({ replies })} />
    );

    fireEvent.click(getByTestId('edit-reply-btn-r1'));

    const input = getByTestId('reply-input');
    expect(input.getAttribute('data-comment-id')).toBe('c1');
    expect(input.getAttribute('data-existing-reply-id')).toBe('r1');
    expect(queryByTestId('reply-r1')).toBeNull();
    // Siblings are untouched.
    expect(getByTestId('reply-r2')).toBeTruthy();
  });

  it('deletes any reply regardless of author', () => {
    const { getByTestId } = render(
      <CommentDisplay comment={makeComment({ replies })} />
    );

    fireEvent.click(getByTestId('delete-reply-btn-r1'));
    expect(mocks.deleteReply).toHaveBeenCalledWith('c1', 'r1');

    fireEvent.click(getByTestId('delete-reply-btn-r2'));
    expect(mocks.deleteReply).toHaveBeenCalledWith('c1', 'r2');
  });

  it('hides the thread and the Reply action when the comment is collapsed', () => {
    const { getByTestId, queryByTestId } = render(
      <CommentDisplay comment={makeComment({ replies })} />
    );

    fireEvent.click(getByTestId('comment-collapse-toggle-c1'));

    expect(queryByTestId('thread-c1')).toBeNull();
    expect(queryByTestId('reply-r1')).toBeNull();
    expect(queryByTestId('reply-btn-c1')).toBeNull();
  });

  it('hides the thread on the global toggle-all-comments event', () => {
    const { queryByTestId } = render(
      <CommentDisplay comment={makeComment({ replies })} />
    );

    fireEvent(
      document,
      new CustomEvent('toggle-all-comments', { detail: { collapsed: true } })
    );

    expect(queryByTestId('thread-c1')).toBeNull();
    expect(queryByTestId('reply-btn-c1')).toBeNull();
  });

  it('gives replies no category, severity or confidence badges', () => {
    const { getByTestId } = render(
      <CommentDisplay
        comment={makeComment({
          replies,
          severity: 'major',
          confidence: 'high',
        })}
      />
    );

    const thread = getByTestId('thread-c1');
    expect(thread.querySelector('.category-badge')).toBeNull();
    expect(
      thread.querySelector('[data-testid^="comment-severity-"]')
    ).toBeNull();
    expect(
      thread.querySelector('[data-testid^="comment-confidence-"]')
    ).toBeNull();
  });
});
