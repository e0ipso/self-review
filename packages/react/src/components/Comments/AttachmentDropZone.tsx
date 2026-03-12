import React, { useRef, useCallback } from 'react';
import { ImageIcon } from 'lucide-react';
import { processImageFile } from '../../utils/image-utils';
import type { Attachment } from '@self-review/types';

export interface AttachmentDropZoneProps {
  onAttach: (attachments: Attachment[]) => void;
  children: React.ReactNode;
  isDragging: boolean;
  onDragChange: (isDragging: boolean) => void;
}

export function AttachmentDropZone({
  onAttach,
  children,
  isDragging,
  onDragChange,
}: AttachmentDropZoneProps) {
  const dragCounter = useRef(0);

  const handleImageFiles = useCallback(async (files: (File | Blob)[]) => {
    try {
      const newAttachments = await Promise.all(files.map(processImageFile));
      onAttach(newAttachments);
    } catch (err) {
      console.error('Failed to attach image:', err);
    }
  }, [onAttach]);

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return;
    e.preventDefault();
    const files = imageItems
      .map(item => item.getAsFile())
      .filter((f): f is File => f !== null);
    if (files.length > 0) {
      handleImageFiles(files);
    }
  }, [handleImageFiles]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    onDragChange(false);
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    handleImageFiles(files);
  }, [handleImageFiles, onDragChange]);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      onDragChange(true);
    }
  }, [onDragChange]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      onDragChange(false);
    }
  }, [onDragChange]);

  return (
    <div
      onPaste={handlePaste}
      onDrop={handleDrop}
      onDragOver={(e) => e.preventDefault()}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
    >
      {isDragging && (
        <div className='absolute inset-0 z-50 flex items-center justify-center bg-primary/10 backdrop-blur-[1px] rounded-lg pointer-events-none'>
          <div className='flex items-center gap-2 text-sm font-medium text-primary'>
            <ImageIcon className='h-5 w-5' />
            Drop image to attach
          </div>
        </div>
      )}
      {children}
    </div>
  );
}
