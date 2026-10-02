import React, { useState, useEffect } from 'react';
import type { Attachment } from '@self-review/types';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { ImageOff } from 'lucide-react';

export interface AttachmentImageProps {
  attachment: Attachment;
}

export function AttachmentImage({ attachment }: AttachmentImageProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const adapter = useAdapter();

  useEffect(() => {
    // `active` goes false in cleanup, so a late read creates no blob URL the cleanup would miss.
    let active = true;
    let url: string | null = null;
    setImageUrl(null);
    setError(false);

    const show = (bytes: BlobPart) => {
      url = URL.createObjectURL(new Blob([bytes]));
      setImageUrl(url);
    };

    if (attachment.data) {
      show(attachment.data);
    } else if (attachment.fileName && adapter?.readAttachment) {
      adapter.readAttachment(attachment.fileName).then(
        buffer => {
          if (!active) return;
          if (buffer) show(buffer);
          else setError(true);
        },
        () => {
          if (active) setError(true);
        }
      );
    }

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.data, attachment.fileName, adapter]);

  if (error) {
    return (
      <div className='flex items-center gap-1 text-muted-foreground text-sm p-2 border rounded bg-muted'>
        <ImageOff className='h-4 w-4' />
        <span>Image not found</span>
      </div>
    );
  }

  if (!imageUrl) return null;

  const openImageWindow = () => {
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><title>Attachment</title>
<style>body{margin:0;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1a1a;}</style>
</head><body><img src="${imageUrl}" style="max-width:100%;max-height:100vh;object-fit:contain;"/></body></html>`);
    win.document.close();
  };

  return (
    <img
      src={imageUrl}
      alt='Attachment'
      className='max-h-48 rounded border cursor-pointer hover:opacity-80'
      onClick={openImageWindow}
    />
  );
}
