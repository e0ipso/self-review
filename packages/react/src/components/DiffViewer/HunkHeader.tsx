import React from 'react';

export interface HunkHeaderProps {
  header: string;
}

export default function HunkHeader({ header }: HunkHeaderProps) {
  return (
    <div className='hunk-header flex items-center h-7 px-3 bg-accent/30 text-muted-foreground/70 text-xs font-mono border-t border-border/30'>
      {header}
    </div>
  );
}
