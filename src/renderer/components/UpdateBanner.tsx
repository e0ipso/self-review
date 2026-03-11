import React, { useState, useEffect } from 'react';
import { Button } from '../../../packages/react/src/components/ui/button';
import { ArrowUpCircle, X } from 'lucide-react';
import { VersionUpdateInfo } from '../../shared/types';

export default function UpdateBanner() {
  const [updateInfo, setUpdateInfo] = useState<VersionUpdateInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    window.electronAPI.onVersionUpdate((info) => {
      setUpdateInfo(info);
    });
    window.electronAPI.requestVersionUpdate();
  }, []);

  if (!updateInfo || dismissed) return null;

  return (
    <div
      className="flex items-center justify-between h-8 px-3 border-b border-border bg-blue-50 dark:bg-blue-950 text-xs"
      data-testid="update-banner"
    >
      <div className="flex items-center gap-2">
        <ArrowUpCircle className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
        <span>
          Self Review v{updateInfo.latestVersion} is available.{' '}
          <button
            className="underline text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 cursor-pointer"
            onClick={() => window.electronAPI.openExternal(updateInfo.releaseUrl)}
          >
            View release
          </button>
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => setDismissed(true)}
        data-testid="update-banner-dismiss"
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
}
