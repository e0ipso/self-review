import React from 'react';
import { it, expect, vi } from 'vitest';
import { act, render, screen, fireEvent } from '@testing-library/react';
import type { Attachment } from '@self-review/types';
import { useImageAttachments } from '../../hooks/useImageAttachments';
import { AttachmentProcessingContext, AttachmentProcessingStatus } from './AttachmentProcessing';
import { AttachmentDropZone } from './AttachmentDropZone';
import { AttachButton } from './ComposerCore';

it('shares paste, drop and picker work and keeps successes beside a failed file', async () => {
  const attached = vi.fn();
  const process = vi.fn(async (file: File | Blob): Promise<Attachment> => {
    if ('name' in file && file.name === 'bad.png') throw new Error('decode');
    return {
      id: 'name' in file ? file.name : 'pasted',
      mediaType: 'image/png',
      fileName: 'image.png',
    };
  });
  function Composer() {
    const ingestion = useImageAttachments({ onAttach: attached, process });
    return (
      <AttachmentProcessingContext.Provider value={ingestion}>
        <AttachmentDropZone onAttach={attached} isDragging={false} onDragChange={vi.fn()}>
          <textarea aria-label='Body' />
        </AttachmentDropZone>
        <AttachButton setAttachments={vi.fn()} />
        <AttachmentProcessingStatus ingestion={ingestion} />
      </AttachmentProcessingContext.Provider>
    );
  }
  const { container } = render(<Composer />);
  const file = (name: string) => new File(['png'], name, { type: 'image/png' });
  await act(async () =>
    fireEvent.paste(screen.getByRole('textbox'), {
      clipboardData: { items: [{ type: 'image/png', getAsFile: () => file('paste.png') }] },
    })
  );
  await act(async () =>
    fireEvent.drop(screen.getByRole('textbox'), {
      dataTransfer: { files: [file('drop.png'), file('bad.png')] },
    })
  );
  await act(async () =>
    fireEvent.change(container.querySelector('input[type=file]')!, {
      target: { files: [file('picker.png')] },
    })
  );
  expect(process).toHaveBeenCalledTimes(4);
  expect(attached).toHaveBeenCalledTimes(3);
  expect(screen.getByRole('alert').textContent).toContain('bad.png');
  expect(screen.getByRole('button', { name: 'Retry' })).toBeTruthy();
});
