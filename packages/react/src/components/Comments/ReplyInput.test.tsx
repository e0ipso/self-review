import React from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import type { Attachment, Reply } from '@self-review/types';
import ReplyInput from './ReplyInput';

const mocks = vi.hoisted(() => ({
  addReply: vi.fn(),
  updateReply: vi.fn(),
}));

vi.mock('../../context/ReviewContext', () => ({
  useReview: () => ({
    addReply: mocks.addReply,
    updateReply: mocks.updateReply,
  }),
}));

vi.mock('./ComposerCore', () => ({
  ComposerCore: ({
    body,
    attachments,
    setAttachments,
    children,
  }: {
    body: string;
    attachments: Attachment[];
    setAttachments: React.Dispatch<React.SetStateAction<Attachment[]>>;
    children: React.ReactNode;
  }) => (
    <div>
      <span data-testid='reply-body'>{body}</span>
      {attachments.map((attachment) => (
        <button
          key={attachment.id}
          data-testid={`remove-attachment-${attachment.id}`}
          onClick={() =>
            setAttachments((current) =>
              current.filter((candidate) => candidate.id !== attachment.id)
            )
          }
        >
          Remove {attachment.fileName}
        </button>
      ))}
      {children}
    </div>
  ),
  AttachButton: () => null,
}));

describe('ReplyInput', () => {
  beforeEach(() => {
    mocks.addReply.mockReset();
    mocks.updateReply.mockReset();
  });

  it('clears an existing reply attachment after removing its final thumbnail and updating', () => {
    const existingReply: Reply = {
      id: 'reply-1',
      body: 'Keep this reply body',
      attachments: [
        {
          id: 'attachment-1',
          fileName: 'evidence.png',
          mediaType: 'image/png',
        },
      ],
    };

    const { getByTestId } = render(
      <ReplyInput
        commentId='comment-1'
        existingReply={existingReply}
        onCancel={vi.fn()}
      />
    );

    fireEvent.click(getByTestId('remove-attachment-attachment-1'));
    fireEvent.click(getByTestId('add-reply-btn'));

    expect(mocks.updateReply).toHaveBeenCalledWith('comment-1', 'reply-1', {
      body: 'Keep this reply body',
      attachments: undefined,
    });
  });
});
