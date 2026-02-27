import React from 'react';

function splitPath(fullPath: string) {
  const lastSlash = fullPath.lastIndexOf('/');
  if (lastSlash === -1) return { dir: '', fileName: fullPath };
  return {
    dir: fullPath.slice(0, lastSlash + 1),
    fileName: fullPath.slice(lastSlash + 1),
  };
}

interface TruncatedPathProps {
  path: string;
  className?: string;
}

export default function TruncatedPath({ path, className = '' }: TruncatedPathProps) {
  const { dir, fileName } = splitPath(path);

  return (
    <span className={`flex-1 min-w-0 flex font-mono text-xs leading-tight ${className}`}>
      {dir && (
        <span className='truncate text-muted-foreground/70'>
          {dir}
        </span>
      )}
      <span className='flex-shrink-0 whitespace-nowrap'>
        {fileName}
      </span>
    </span>
  );
}
