import React, { useState, useEffect } from 'react';
import type { Attachment } from '@self-review/types';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { useLocalization } from '../../localization/LocalizationContext';
import { useOptionalSnapshotKey } from '../../context/ReviewContext';
import { Button } from '../ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogTitle, DialogDescription } from '../ui/dialog';
import { ImageOff } from 'lucide-react';
import { readAttachment } from '../../read-service';

export interface AttachmentImageProps {
  attachment: Attachment;
}

export function AttachmentImage({ attachment }: AttachmentImageProps) {
  const { t } = useLocalization();
  const snapshot = useOptionalSnapshotKey();
  const [retry, setRetry] = useState(0);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const adapter = useAdapter();

  useEffect(() => {
    // `active` goes false in cleanup, so a late read creates no blob URL the cleanup would miss.
    let active = true;
    const controller = new AbortController();
    let url: string | null = null;
    setImageUrl(null);
    setError(null);

    const show = (bytes: BlobPart) => {
      url = URL.createObjectURL(new Blob([bytes], { type: attachment.mediaType }));
      setImageUrl(url);
    };

    if (attachment.data) {
      show(attachment.data);
    } else if (attachment.fileName && (adapter?.reads?.readAttachment || adapter?.readAttachment)) {
      readAttachment(adapter, attachment.fileName, controller.signal).then(
        buffer => {
          if (!active) return;
          if (buffer) show(buffer);
          else setError(t('Image not found'));
        },
        reason => {
          if (active) setError(reason instanceof Error ? reason.message : t('Image not found'));
        }
      );
    } else {
      setError(t('Image not found'));
    }

    return () => {
      active = false;
      controller.abort();
      if (url) URL.revokeObjectURL(url);
    };
  }, [attachment.data, attachment.fileName, attachment.mediaType, adapter, snapshot, retry, t]);

  if (error) {
    return (
      <div
        role='alert'
        className='flex items-center gap-1 text-muted-foreground text-sm p-2 border rounded bg-muted'
      >
        <ImageOff className='h-4 w-4' />
        <span>{error}</span>
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
            onError={() => setError(t('Image not found'))}
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
          onError={() => setError(t('Image not found'))}
        />
      </DialogContent>
    </Dialog>
  );
}
