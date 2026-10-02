import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import type { Attachment, CategoryDef, ReviewComment } from '@self-review/types';

import { installBrowserApiStubs } from '../../test-helpers';

installBrowserApiStubs();

import CommentInput from './CommentInput';
import { ConfigProvider } from '../../context/ConfigContext';
import { DEFAULT_CATEGORIES } from '../../config-defaults';

const mocks = vi.hoisted(() => ({
  addComment: vi.fn(),
  editComment: vi.fn(),
}));

vi.mock('../../context/ReviewContext', () => ({
  useReview: () => ({
    addComment: mocks.addComment,
    editComment: mocks.editComment,
  }),
}));

// Swaps the MDEditor-based composer for a plain textarea so the tests can
// drive the comment body without pulling in the full editor stack. The
// actions bar (category selector + submit button) is the thing under test,
// so it is passed through untouched via `children`. Each attachment gets a
// remove button wired the way the real thumbnail strip removes one.
vi.mock('./ComposerCore', () => ({
  ComposerCore: ({
    body,
    onBodyChange,
    attachments,
    setAttachments,
    children,
  }: {
    body: string;
    onBodyChange: (body: string) => void;
    attachments: Attachment[];
    setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
    children: React.ReactNode;
  }) => (
    <div>
      <textarea
        data-testid='body-input'
        value={body}
        onChange={e => onBodyChange(e.target.value)}
      />
      {attachments.map(att => (
        <button
          key={att.id}
          data-testid={`remove-attachment-${att.id}`}
          onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
        />
      ))}
      {children}
    </div>
  ),
  AttachButton: () => null,
}));

function renderCommentInput(categories: CategoryDef[]) {
  return render(
    <ConfigProvider initialConfig={{ categories }}>
      <CommentInput filePath='src/foo.ts' lineRange={null} onCancel={vi.fn()} />
    </ConfigProvider>
  );
}

describe('CommentInput category handling', () => {
  beforeEach(() => {
    mocks.addComment.mockReset();
    mocks.editComment.mockReset();
  });

  it('defaults to the first configured category and submits it', () => {
    renderCommentInput([
      { name: 'bug', description: 'Defect', color: '#e53e3e' },
      { name: 'nit', description: 'Nitpick', color: '#718096' },
    ]);

    fireEvent.change(screen.getByTestId('body-input'), {
      target: { value: 'Looks off' },
    });
    fireEvent.click(screen.getByTestId('add-comment-btn'));

    expect(mocks.addComment).toHaveBeenCalledWith(
      'src/foo.ts',
      null,
      'Looks off',
      'bug',
      null,
      undefined
    );
  });

  it('skips a blank-name category when picking the default and still allows submission', () => {
    renderCommentInput([
      { name: '', description: 'Nameless', color: '#ff0000' },
      { name: 'question', description: 'Clarification', color: '#805ad5' },
    ]);

    fireEvent.change(screen.getByTestId('body-input'), {
      target: { value: 'Why is this here?' },
    });
    const submitBtn = screen.getByTestId('add-comment-btn') as HTMLButtonElement;
    expect(submitBtn.disabled).toBe(false);

    fireEvent.click(submitBtn);

    expect(mocks.addComment).toHaveBeenCalledWith(
      'src/foo.ts',
      null,
      'Why is this here?',
      'question',
      null,
      undefined
    );
  });

  // SR-0040: ConfigProvider now falls back to the built-in categories before
  // CommentInput ever sees an unusable list, so submission is no longer stuck
  // disabled with nothing to explain why — it recovers with a default category
  // and a stderr warning.
  it('falls back to a default category and allows submission when given no usable categories', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderCommentInput([]);

    fireEvent.change(screen.getByTestId('body-input'), {
      target: { value: 'Anything' },
    });
    const submitBtn = screen.getByTestId('add-comment-btn') as HTMLButtonElement;

    expect(submitBtn.disabled).toBe(false);

    fireEvent.click(submitBtn);
    expect(mocks.addComment).toHaveBeenCalledWith(
      'src/foo.ts',
      null,
      'Anything',
      DEFAULT_CATEGORIES[0].name,
      null,
      undefined
    );
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no usable categories'));

    errorSpy.mockRestore();
  });
});

describe('CommentInput editing attachments', () => {
  beforeEach(() => {
    mocks.editComment.mockReset();
  });

  it('clears the stored attachments when the last one is removed before Update', () => {
    const comment: ReviewComment = {
      id: 'c1',
      filePath: 'src/foo.ts',
      lineRange: null,
      body: 'See screenshot',
      category: 'bug',
      suggestion: null,
      attachments: [{ id: 'att-1', fileName: 'shot.png', mediaType: 'image/png' }],
    };
    render(
      <ConfigProvider>
        <CommentInput
          filePath='src/foo.ts'
          lineRange={null}
          existingComment={comment}
          onCancel={vi.fn()}
        />
      </ConfigProvider>
    );

    fireEvent.click(screen.getByTestId('remove-attachment-att-1'));
    fireEvent.click(screen.getByTestId('add-comment-btn'));

    expect(mocks.editComment).toHaveBeenCalledTimes(1);
    const updates = mocks.editComment.mock.calls[0][1] as Partial<ReviewComment>;
    // The key must be present: editComment merges, so an omitted key keeps the old list.
    expect(Object.prototype.hasOwnProperty.call(updates, 'attachments')).toBe(true);
    expect({ ...comment, ...updates }.attachments ?? []).toHaveLength(0);
  });
});
