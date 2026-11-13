import type { ElectronAPI } from '../../shared/types';
import React, { useState, useEffect } from 'react';
import { Button } from '../../../packages/react/src/components/ui/button';
import { ArrowUpCircle, X } from 'lucide-react';
import { useDesktopLocalization } from '../useDesktopLocalization';
import { VersionUpdateInfo } from '../../shared/types';

type UpdateBannerAPI = Pick<
  ElectronAPI,
  'onVersionUpdate' | 'requestVersionUpdate' | 'openExternal'
>;

export default function UpdateBanner({ api = window.electronAPI }: { api?: UpdateBannerAPI }) {
  const { t } = useDesktopLocalization();
  const [updateInfo, setUpdateInfo] = useState<VersionUpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const unsubscribe = api.onVersionUpdate(info => {
      setUpdateInfo(info);
    });
    api.requestVersionUpdate();
    return unsubscribe;
  }, [api]);

  if (!updateInfo || dismissed) return null;

  return (
    <div
      className='flex shrink-0 items-center justify-between h-8 px-3 border-b border-border bg-blue-50 dark:bg-blue-950 text-xs'
      data-testid='update-banner'
    >
      <div className='flex items-center gap-2'>
        <ArrowUpCircle className='h-3.5 w-3.5 text-blue-600 dark:text-blue-400' />
        <span>
          {t('Self Review v{version} is available.', { version: updateInfo.latestVersion })}{' '}
          <button
            className='underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer'
            onClick={() => api.openExternal(updateInfo.releaseUrl)}
          >
            {t('View release')}
          </button>
        </span>
      </div>
      <Button
        variant='ghost'
        size='sm'
        className='h-5 w-5 p-0 text-muted-foreground hover:text-foreground'
        onClick={() => setDismissed(true)}
        data-testid='update-banner-dismiss'
      >
        <X className='h-3 w-3' />
        <span className='sr-only'>{t('Dismiss')}</span>
      </Button>
    </div>
  );
}
