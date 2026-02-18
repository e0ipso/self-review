import React, { useState, useEffect } from 'react';
import type { Attachment } from '../../../shared/types';
import { Button } from '../ui/button';
import { X, ImageIcon } from 'lucide-react';

export default function AttachmentThumbnail({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!attachment.data) return;
    const objectUrl = URL.createObjectURL(new Blob([attachment.data]));
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [attachment.id, attachment.data]);

  return (
    <div className='relative group'>
      {url ? (
        <img
          src={url}
          alt='Attachment preview'
          className='h-16 w-16 object-cover rounded border'
        />
      ) : (
        <div className='h-16 w-16 flex items-center justify-center rounded border bg-muted'>
          <ImageIcon className='h-4 w-4 text-muted-foreground' />
        </div>
      )}
      <Button
        variant='ghost'
        size='icon'
        className='absolute -top-2 -right-2 h-5 w-5 rounded-full bg-background border shadow-sm opacity-0 group-hover:opacity-100'
        onClick={onRemove}
      >
        <X className='h-3 w-3' />
      </Button>
    </div>
  );
}
