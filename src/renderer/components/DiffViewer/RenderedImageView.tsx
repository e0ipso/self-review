import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { ImageLoadResult } from '../../../shared/types';

interface RenderedImageViewProps {
  filePath: string;
  dataUri?: string; // pre-loaded (React package context); when absent, load via IPC
}

export default function RenderedImageView({ filePath, dataUri: propDataUri }: RenderedImageViewProps) {
  const [dataUri, setDataUri] = useState<string | null>(propDataUri ?? null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(!propDataUri);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);

  useEffect(() => {
    if (propDataUri) return; // already provided
    let cancelled = false;
    setLoading(true);
    setError(null);
    setDataUri(null);
    setDimensions(null);

    window.electronAPI.loadImage(filePath).then((result: ImageLoadResult) => {
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
  }, [filePath, propDataUri]);

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
