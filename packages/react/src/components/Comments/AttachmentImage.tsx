import React, { useState, useEffect } from 'react';
import type { Attachment } from '@self-review/types';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { useLocalization } from '../../localization/LocalizationContext';
import { useOptionalSnapshotKey } from '../../context/ReviewContext';
import { Button } from '../ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { ImageOff } from 'lucide-react';

export interface AttachmentImageProps {
  attachment: Attachment;
}

export function AttachmentImage({ attachment }: AttachmentImageProps) {
  const { t } = useLocalization();
  const snapshot = useOptionalSnapshotKey();
  const [retry, setRetry] = useState(0);
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
      url = URL.createObjectURL(new Blob([bytes], { type: attachment.mediaType }));
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
    } else {
      setError(true);
    }

    return () => {
      active = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.data, attachment.fileName, attachment.mediaType, adapter, snapshot, retry]);

  if (error) {
    return (
      <div
        role='alert'
        className='flex items-center gap-1 text-muted-foreground text-sm p-2 border rounded bg-muted'
      >
        <ImageOff className='h-4 w-4' />
        <span>{t('Image not found')}</span>
        <Button variant='outline' size='sm' onClick={() => setRetry(value => value + 1)}>
          {t('Retry')}
        </Button>
      </div>
    );
  }

  if (!imageUrl) return <span role='status'>{t('Loading attachment...')}</span>;

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          className='h-auto p-0'
          aria-label={t('Enlarge attachment')}
        >
          <img
            src={imageUrl}
            alt={t('Attachment')}
            className='max-h-48 rounded border hover:opacity-80'
            onError={() => setError(true)}
          />
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-[90vw] max-h-[90vh] overflow-auto'>
        <DialogTitle>{t('Attachment')}</DialogTitle>
        <DialogDescription className='sr-only'>
          {t('Enlarged attachment preview')}
        </DialogDescription>
        <img
          src={imageUrl}
          alt={t('Attachment')}
          className='max-w-full max-h-[75vh] object-contain'
          onError={() => setError(true)}
        />
      </DialogContent>
    </Dialog>
  );
}
