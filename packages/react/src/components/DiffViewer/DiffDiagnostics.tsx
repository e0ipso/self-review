import React from 'react';
import { AlertTriangle } from 'lucide-react';

export interface DiffDiagnosticsProps {
  /** One message per thing the host could not load faithfully. */
  diagnostics: string[];
  /** Headline above the list. */
  title: string;
}

/**
 * What the loader could not show faithfully (`DiffLoadPayload.diagnostics`):
 * an unsupported `git diff` output format, or output the parser could not
 * represent, such as a merge conflict's combined section. Rendered instead of
 * "no changes" when nothing loaded, and as a banner above the files otherwise,
 * so a partial or failed load is never mistaken for a clean, empty review.
 */
export function DiffDiagnostics({ diagnostics, title }: DiffDiagnosticsProps) {
  if (diagnostics.length === 0) return null;
  return (
    <div
      role='alert'
      data-testid='diff-diagnostics'
      className='rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground'
    >
      <div className='flex items-center gap-2 font-medium'>
        <AlertTriangle className='h-4 w-4 text-amber-600 dark:text-amber-400' aria-hidden />
        <span>{title}</span>
      </div>
      <ul className='mt-2 list-disc space-y-1 pl-6 text-muted-foreground'>
        {diagnostics.map((message, index) => (
          <li key={index} className='font-mono text-xs break-words'>
            {message}
          </li>
        ))}
      </ul>
    </div>
  );
}
