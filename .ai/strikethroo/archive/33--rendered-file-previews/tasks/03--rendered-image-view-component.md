---
id: 3
group: renderer
dependencies:
  - 1
  - 2
status: completed
created: '2026-03-09'
skills:
  - react-components
  - typescript
---
# Build RenderedImageView Component

## Objective
Create the `RenderedImageView` React component that displays a raster image preview inside the diff viewer. It loads the image via IPC (Electron context) or accepts a pre-loaded data URI as a prop (React package context).

## Skills Required
- React components — loading state, image display, error handling
- TypeScript — props interface, conditional IPC invocation

## Acceptance Criteria
- [ ] Component renders a loading spinner while fetching the image
- [ ] On success, displays `<img>` with `max-width: 100%` and `max-height: 80vh` constraints, centred horizontally
- [ ] Displays natural image dimensions as metadata once the image loads (e.g. "1920 × 1080")
- [ ] On error, shows a graceful error message (uses the error string from IPC response)
- [ ] Accepts optional `dataUri?: string` prop — when provided, skips IPC loading and renders directly (for `@self-review/react` package usage)
- [ ] Does NOT render any comment UI — file-level comments are owned by `FileSection`

## Technical Requirements
- File location: `src/renderer/components/DiffViewer/RenderedImageView.tsx`
- Props:
  ```ts
  interface RenderedImageViewProps {
    filePath: string;
    dataUri?: string; // pre-loaded (React package context); when absent, load via IPC
  }
  ```
- Use `useState` for `{ dataUri, error, loading }` state
- Use `useEffect` on mount (or when `filePath` changes) — skip effect if `dataUri` prop is provided
- IPC call: `window.electronAPI.loadImage(filePath)`
- Use `onLoad` event of `<img>` to read `naturalWidth` / `naturalHeight` and display dimensions
- Use shadcn/ui `Skeleton` or just a `Loader2` spinner for loading state (match existing patterns in `FileSection.tsx`)
- Centre the image with `flex justify-center`; wrap in a `div` with `p-4` padding

## Input Dependencies
- Task 01: `isPreviewableImage` utility (informational context)
- Task 02: `window.electronAPI.loadImage` method + `ImageLoadResult` type

## Output Artifacts
- `src/renderer/components/DiffViewer/RenderedImageView.tsx`

## Implementation Notes

<details>
<summary>Implementation details</summary>

```tsx
import React, { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import type { ImageLoadResult } from '../../../shared/types';

interface RenderedImageViewProps {
  filePath: string;
  dataUri?: string;
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
    window.electronAPI.loadImage(filePath).then((result: ImageLoadResult) => {
      if (cancelled) return;
      if ('error' in result) {
        setError(result.error);
      } else {
        setDataUri(result.dataUri);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
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
```

Ensure no trailing spaces and a newline at end of file.
</details>
