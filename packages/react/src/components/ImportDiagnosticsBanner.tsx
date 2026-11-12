import { useLocalization } from '../localization/LocalizationContext';
import React, { useState, useContext, useMemo, useSyncExternalStore } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui/button';
import { useReview } from '../context/ReviewContext';
import { SessionStoreContext } from '../context/review-context';
import type { ReviewSessionStore } from '../context/review-session';

const NO_DIAGNOSTICS: string[] = [];

/** Dismissible, non-blocking list of resumed comments the importer downgraded to file-level feedback. */
export default function ImportDiagnosticsBanner() {
  const store = useContext(SessionStoreContext);
  return store ? <StoredDiagnostics store={store} /> : <LegacyDiagnostics />;
}

function StoredDiagnostics({ store }: { store: ReviewSessionStore }) {
  const readImported = () => store.getSnapshot().resumedReview?.importDiagnostics ?? NO_DIAGNOSTICS;
  const readAnchors = () => store.getSnapshot().anchorDiagnostics;
  const readSession = () => store.getSnapshot().sessionId;
  const imported = useSyncExternalStore(store.subscribe, readImported, readImported);
  const anchors = useSyncExternalStore(store.subscribe, readAnchors, readAnchors);
  const sessionId = useSyncExternalStore(store.subscribe, readSession, readSession);
  const messages = useMemo(() => [...imported, ...anchors], [imported, anchors]);
  return <DiagnosticsBanner key={sessionId} importDiagnostics={messages} />;
}

function LegacyDiagnostics() {
  const { importDiagnostics, sessionId } = useReview();
  return <DiagnosticsBanner key={sessionId} importDiagnostics={importDiagnostics} />;
}

function DiagnosticsBanner({ importDiagnostics }: { importDiagnostics: string[] }) {
  const { t } = useLocalization();
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
          <span>{t('Resumed comments without anchors', { count: importDiagnostics.length })}</span>
          <ul className='mt-0.5 list-disc space-y-0.5 ps-5 text-muted-foreground'>
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
        <span className='sr-only'>{t('Dismiss')}</span>
      </Button>
    </div>
  );
}
