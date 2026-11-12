import { useLocalization } from '../../localization/LocalizationContext';
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { ImageLoadResult } from '@self-review/types';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { useOptionalSnapshotKey } from '../../context/ReviewContext';
import { loadImage } from '../../read-service';

interface RenderedImageViewProps {
  filePath: string;
  onLoadImage?: (filePath: string) => Promise<ImageLoadResult>;
}

export default function RenderedImageView({ filePath, onLoadImage }: RenderedImageViewProps) {
  const { t } = useLocalization();
  const adapter = useAdapter();
  const snapshot = useOptionalSnapshotKey();
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState<{ unsupported?: boolean; detail?: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!onLoadImage && !adapter?.reads?.loadImage && !adapter?.loadImage) {
      setError({ unsupported: true });
      setLoading(false);
      return;
    }

    let cancelled = false;
    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setDataUri(null);
    setDimensions(null);

    // Hosts may reject instead of returning `{ error }`; both settle into the error state.
    // Explicit legacy props still work; first-party previews discover cancellable adapter reads.
    const read =
      onLoadImage && onLoadImage !== adapter?.loadImage
        ? onLoadImage(filePath)
        : loadImage(adapter, filePath, controller.signal);
    read.then(
      (result: ImageLoadResult) => {
        if (cancelled) return;
        if (!result) {
          setError({});
        } else if ('error' in result) {
          setError({ detail: result.error });
        } else {
          setDataUri(result.dataUri);
        }
        setLoading(false);
      },
      (reason: unknown) => {
        if (cancelled) return;
        setError({ detail: reason instanceof Error ? reason.message : undefined });
        setLoading(false);
      }
    );

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [filePath, onLoadImage, adapter, snapshot]);

  if (loading) {
    return (
      <div
        role='status'
        aria-label={t('Loading image...')}
        className='flex justify-center items-center p-8'
      >
        <Loader2 aria-hidden='true' className='h-6 w-6 animate-spin text-muted-foreground' />
        <span className='sr-only'>{t('Loading image...')}</span>
      </div>
    );
  }

  if (error || !dataUri) {
    return (
      <div
        role='alert'
        aria-label={t('Image preview unavailable')}
        className='flex flex-col justify-center items-center p-8 text-sm text-muted-foreground'
      >
        <p>
          {t(
            error?.unsupported
              ? 'Image loading not supported in this context.'
              : 'Failed to load image.'
          )}
        </p>
        {error?.detail && <p>{error.detail}</p>}
      </div>
    );
  }

  return (
    <div className='flex flex-col items-center p-4 gap-2'>
      <img
        src={dataUri}
        alt={filePath}
        onError={() => setError({})}
        style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
        onLoad={e => {
          const img = e.currentTarget;
          setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        }}
      />
      {dimensions && (
        <span className='text-xs text-muted-foreground'>
          {dimensions.w} × {dimensions.h}
        </span>
      )}
    </div>
  );
}
