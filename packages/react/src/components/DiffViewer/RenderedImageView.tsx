import { useLocalization } from '../../localization/LocalizationContext';
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Button } from '../ui/button';
import { Loader2 } from 'lucide-react';
import type { ImageLoadResult } from '@self-review/types';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { useOptionalSnapshotKey } from '../../context/ReviewContext';
import { loadImage } from '../../read-service';
import { isPassiveImageUrl } from '../../utils/passive-content';

interface RenderedImageViewProps {
  filePath: string;
  onLoadImage?: (filePath: string) => Promise<ImageLoadResult>;
}

export default function RenderedImageView({ filePath, onLoadImage }: RenderedImageViewProps) {
  const { t, number } = useLocalization();
  const adapter = useAdapter();
  const snapshot = useOptionalSnapshotKey();
  const [attempt, setAttempt] = useState(0);
  const request = useMemo(() => ({}), [filePath, onLoadImage, adapter, snapshot, attempt]);
  const owner = useRef<object | null>(request);
  // A replacement hides the old URL during render, before passive effect cleanup.
  owner.current = request;
  const [state, setState] = useState<{
    request: object;
    dataUri?: string;
    error?: { unsupported?: boolean; detail?: string };
    dimensions?: { w: number; h: number };
  } | null>(null);
  const current = state?.request === request ? state : null;
  const { dataUri, error, dimensions } = current ?? {};
  const loading = !current;

  useEffect(() => {
    owner.current = request;
    const controller = new AbortController();
    const currentRequest = () => !controller.signal.aborted && owner.current === request;
    if (!onLoadImage && !adapter?.reads?.loadImage && !adapter?.loadImage) {
      setState({ request, error: { unsupported: true } });
    } else {
      // An async boundary catches synchronous custom loader throws as well as rejections.
      const read = async () =>
        onLoadImage && onLoadImage !== adapter?.loadImage
          ? onLoadImage(filePath)
          : loadImage(adapter, filePath, controller.signal);
      void read().then(
        result => {
          if (!currentRequest()) return;
          if (!result) setState({ request, error: {} });
          else if ('error' in result) setState({ request, error: { detail: result.error } });
          else if (typeof result.dataUri === 'string' && isPassiveImageUrl(result.dataUri))
            setState({ request, dataUri: result.dataUri });
          else setState({ request, error: {} });
        },
        (reason: unknown) => {
          if (currentRequest())
            setState({
              request,
              error: { detail: reason instanceof Error ? reason.message : undefined },
            });
        }
      );
    }
    return () => {
      controller.abort();
      if (owner.current === request) owner.current = null;
    };
  }, [filePath, onLoadImage, adapter, request]);

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
        {!error?.unsupported && (
          <Button variant='outline' size='sm' onClick={() => setAttempt(value => value + 1)}>
            {t('Retry')}
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className='flex flex-col items-center p-4 gap-2'>
      <img
        src={dataUri}
        alt={filePath}
        onError={() => {
          if (owner.current === request) setState({ request, error: {} });
        }}
        style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
        onLoad={e => {
          const img = e.currentTarget;
          if (owner.current === request)
            setState({
              request,
              dataUri,
              dimensions: { w: img.naturalWidth, h: img.naturalHeight },
            });
        }}
      />
      {dimensions && (
        <span className='text-xs text-muted-foreground'>
          {number(dimensions.w)} × {number(dimensions.h)}
        </span>
      )}
    </div>
  );
}
