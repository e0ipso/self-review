import React from 'react';

export interface HunkHeaderProps {
  header: string;
}

export default function HunkHeader({ header }: HunkHeaderProps) {
  return (
    <div className='hunk-header flex items-center h-7 px-3 text-xs font-mono bg-blue-500/10 dark:bg-blue-400/15 text-blue-700 dark:text-blue-300'>
      {header}
    </div>
  );
}
