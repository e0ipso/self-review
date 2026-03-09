import React, { useMemo } from 'react';
import type { DiffFile } from '../../../shared/types';

interface RenderedSvgViewProps {
  file: DiffFile;
  svgContent?: string; // pre-extracted (React package context)
}

function extractSvgContent(file: DiffFile): string {
  return file.hunks
    .flatMap(hunk => hunk.lines)
    .filter(line => line.type === 'addition')
    .map(line => line.content.slice(1))
    .join('\n');
}

function svgToDataUri(svgContent: string): string {
  // Handle non-ASCII characters safely
  return `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgContent)))}`;
}

export default function RenderedSvgView({ file, svgContent: propContent }: RenderedSvgViewProps) {
  const svgContent = useMemo(
    () => propContent ?? extractSvgContent(file),
    [file, propContent]
  );

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
