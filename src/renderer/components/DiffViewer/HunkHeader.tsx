import React from 'react';

export interface HunkHeaderProps {
  header: string;
}

export default function HunkHeader({ header }: HunkHeaderProps) {
  return (
    <div className="hunk-header bg-muted/50 text-muted-foreground text-xs px-4 py-1 font-mono border-y border-border">
      {header}
    </div>
  );
}
