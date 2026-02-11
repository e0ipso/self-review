import React from 'react';

export interface HunkHeaderProps {
  header: string;
}

export default function HunkHeader({ header }: HunkHeaderProps) {
  return (
    <div className="hunk-header flex items-center h-8 px-3 bg-accent/50 text-muted-foreground text-xs font-mono border-y border-border/50">
      {header}
    </div>
  );
}
