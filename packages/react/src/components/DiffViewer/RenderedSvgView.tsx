import React, { useMemo } from 'react';
import type { DiffFile } from '@self-review/core';

interface RenderedSvgViewProps {
  file: DiffFile;
}

function extractSvgContent(file: DiffFile): string {
  return file.hunks
    .flatMap(hunk => hunk.lines)
    .filter(line => line.type === 'addition')
    .map(line => line.content)
    .join('\n');
}

function svgToDataUri(svgContent: string): string {
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
}

export default function RenderedSvgView({ file }: RenderedSvgViewProps) {
  const svgContent = useMemo(() => extractSvgContent(file), [file]);

  if (!svgContent.trim()) {
    return (
      <div className="flex justify-center items-center p-8 text-sm text-muted-foreground">
        SVG content could not be extracted.
      </div>
    );
  }

  const dataUri = svgToDataUri(svgContent);

  return (
    <div className="flex justify-center p-4">
      <img
        src={dataUri}
        alt={file.newPath ?? file.oldPath ?? 'SVG preview'}
        style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
      />
    </div>
  );
}
