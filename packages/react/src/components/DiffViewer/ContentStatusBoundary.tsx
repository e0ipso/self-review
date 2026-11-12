import React, { type ReactNode } from 'react';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useLocalization } from '../../localization/LocalizationContext';
import type { LazyLoadState } from './useLazyFileContent';

interface ContentStatusBoundaryProps {
  omittedReason?: string;
  contentLoaded?: boolean;
  contentLoad: LazyLoadState;
  onRetry: () => void;
  children: ReactNode;
}

/** Status takes precedence over every preview and raw layout, without mounting either. */
export function ContentStatusBoundary({
  omittedReason,
  contentLoaded,
  contentLoad,
  onRetry,
  children,
}: ContentStatusBoundaryProps) {
  const { t } = useLocalization();
  // Listed without content on purpose (a safety budget): "No changes" would misstate why.
  if (omittedReason) {
    return (
      <div
        role='status'
        data-testid='content-omitted'
        className='m-3 flex items-start gap-2 text-sm text-muted-foreground p-3 border rounded'
      >
        <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' aria-hidden='true' />
        <p className='min-w-0 flex-1 break-words'>{omittedReason}</p>
      </div>
    );
  }

  if (contentLoad.kind === 'loading' || (contentLoad.kind === 'idle' && contentLoaded === false)) {
    return (
      <div
        role='status'
        className='flex items-center justify-center py-12 text-sm text-muted-foreground'
      >
        <Loader2 className='h-4 w-4 animate-spin me-2' />
        {t('Loading file content...')}
      </div>
    );
  }

  if (contentLoad.kind === 'error') {
    return (
      <div
        role='alert'
        data-testid='content-load-error'
        className='m-3 flex items-start gap-2 text-destructive text-sm p-3 border border-destructive/20 rounded'
      >
        <AlertTriangle className='h-4 w-4 mt-0.5 shrink-0' aria-hidden='true' />
        <div className='min-w-0 flex-1 space-y-1'>
          <p>{t('The content of this file could not be loaded.')}</p>
          <p className='text-xs text-muted-foreground break-words'>{contentLoad.message}</p>
          <p className='text-xs text-muted-foreground'>
            {t(
              'Nothing will be requested again until you retry. If the review host stopped, restart it and then retry.'
            )}
          </p>
        </div>
        <Button variant='outline' size='sm' onClick={onRetry}>
          {t('Retry')}
        </Button>
      </div>
    );
  }

  return children;
}
