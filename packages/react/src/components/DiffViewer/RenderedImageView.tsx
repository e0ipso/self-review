import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { ImageLoadResult } from '@self-review/core';

interface RenderedImageViewProps {
  filePath: string;
  onLoadImage?: (filePath: string) => Promise<ImageLoadResult>;
}

export default function RenderedImageView({ filePath, onLoadImage }: RenderedImageViewProps) {
  const [dataUri, setDataUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (!onLoadImage) {
      setError('Image loading not supported in this context.');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setDataUri(null);
    setDimensions(null);

    onLoadImage(filePath).then((result: ImageLoadResult) => {
      if (cancelled) return;
      if ('error' in result) {
        setError(result.error);
      } else {
        setDataUri(result.dataUri);
      }
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [filePath, onLoadImage]);

  if (loading) {
    return (
      <div className="flex justify-center items-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !dataUri) {
    return (
      <div className="flex justify-center items-center p-8 text-sm text-muted-foreground">
        {error ?? 'Failed to load image.'}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center p-4 gap-2">
      <img
        src={dataUri}
        alt={filePath}
        style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
        onLoad={(e) => {
          const img = e.currentTarget;
          setDimensions({ w: img.naturalWidth, h: img.naturalHeight });
        }}
      />
      {dimensions && (
        <span className="text-xs text-muted-foreground">
          {dimensions.w} × {dimensions.h}
        </span>
      )}
    </div>
  );
}
