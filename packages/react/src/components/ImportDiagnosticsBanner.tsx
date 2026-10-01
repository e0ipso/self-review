import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui/button';
import { useReview } from '../context/ReviewContext';

/**
 * Non-blocking warning listing what the resume importer could not take as
 * written (`ResumeLoadPayload.importDiagnostics`): each named comment is
 * still in the review, downgraded to file-level feedback with its suggestion
 * text folded into the body. Sits beside RemoteDriftBanner and follows its
 * rules: orientation only, dismissible, never gates any review interaction.
 */
export default function ImportDiagnosticsBanner() {
  const { importDiagnostics } = useReview();
  const [dismissed, setDismissed] = useState(false);

  if (importDiagnostics.length === 0 || dismissed) return null;

  return (
    <div
      role='alert'
      className='flex shrink-0 items-start justify-between gap-3 px-3 py-1.5 border-b border-border bg-amber-50 dark:bg-amber-950 text-xs'
      data-testid='import-diagnostics-banner'
    >
      <div className='flex min-w-0 items-start gap-2'>
        <AlertTriangle className='mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400' />
        <div className='min-w-0'>
          <span>
            {importDiagnostics.length === 1
              ? 'One resumed comment'
              : `${importDiagnostics.length} resumed comments`}{' '}
            could not be anchored and {importDiagnostics.length === 1 ? 'was' : 'were'} kept as
            file-level feedback:
          </span>
          <ul className='mt-0.5 list-disc space-y-0.5 pl-5 text-muted-foreground'>
            {importDiagnostics.map((message, index) => (
              <li key={index} className='font-mono break-words'>
                {message}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <Button
        variant='ghost'
        size='sm'
        className='h-5 w-5 shrink-0 p-0 text-muted-foreground hover:text-foreground'
        onClick={() => setDismissed(true)}
        data-testid='import-diagnostics-banner-dismiss'
      >
        <X className='h-3 w-3' />
        <span className='sr-only'>Dismiss</span>
      </Button>
    </div>
  );
}
