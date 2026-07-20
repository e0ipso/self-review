import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../packages/react/src/components/ui/alert-dialog';
import type { AppInfo } from '../../shared/types';

const REPOSITORY_URL = 'https://github.com/e0ipso/self-review';

export default function AboutDialog() {
  const [isOpen, setIsOpen] = useState(false);
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI.onShowAbout(() => setIsOpen(true));
    return unsubscribe;
  }, []);

  useEffect(() => {
    window.electronAPI.getAppInfo().then(setAppInfo).catch(() => {
      // App info unavailable — the dialog still renders without it.
    });
  }, []);

  return (
    <AlertDialog open={isOpen} onOpenChange={setIsOpen}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader className="items-center text-center">
          {appInfo?.iconDataUri && (
            <img
              src={appInfo.iconDataUri}
              alt="self-review"
              className="w-16 h-16 mb-4"
            />
          )}
          <AlertDialogTitle className="text-center">self-review</AlertDialogTitle>
          <AlertDialogDescription className="text-center pt-2">
            <span className="block space-y-1 text-sm">
              {appInfo && <span className="block">Version {appInfo.version}</span>}
              <span className="block text-xs text-muted-foreground">
                GitHub-style PR review UI for local git diffs
              </span>
              <span className="block text-xs text-muted-foreground pt-2">
                © 2026 Mateu Aguiló Bosch
              </span>
              <span className="block text-xs">
                <a
                  href={REPOSITORY_URL}
                  onClick={(e) => {
                    e.preventDefault();
                    window.electronAPI.openExternal(REPOSITORY_URL);
                  }}
                  className="text-blue-600 dark:text-blue-400 hover:underline"
                >
                  github.com/e0ipso/self-review
                </a>
              </span>
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogAction onClick={() => setIsOpen(false)}>OK</AlertDialogAction>
      </AlertDialogContent>
    </AlertDialog>
  );
}
