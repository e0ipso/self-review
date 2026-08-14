import React, { useState } from 'react';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './ui/button';
import { useReview } from '../context/ReviewContext';

/** First seven characters of a SHA, the conventional short form. */
function shortSha(sha: string): string {
  return sha.slice(0, 7);
}

/**
 * Non-blocking warning shown when a resumed remote review's recorded head
 * SHA no longer matches the live PR/MR head: line anchors may be stale.
 * Orientation only — dismissible, never gates any review interaction.
 */
export default function RemoteDriftBanner() {
  const { remoteDrift } = useReview();
  const [dismissed, setDismissed] = useState(false);

  if (!remoteDrift || !remoteDrift.drifted || dismissed) return null;

  return (
    <div
      className="flex shrink-0 items-center justify-between h-8 px-3 border-b border-border bg-amber-50 dark:bg-amber-950 text-xs"
      data-testid="remote-drift-banner"
    >
      <div className="flex items-center gap-2">
        <AlertTriangle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
        <span>
          This PR/MR has changed since this review was recorded (
          <code>{shortSha(remoteDrift.recordedHeadSha)}</code> →{' '}
          <code>{shortSha(remoteDrift.liveHeadSha)}</code>) — line anchors may
          be stale.
        </span>
      </div>
      <Button
        variant="ghost"
        size="sm"
        className="h-5 w-5 p-0 text-muted-foreground hover:text-foreground"
        onClick={() => setDismissed(true)}
        data-testid="remote-drift-banner-dismiss"
      >
        <X className="h-3 w-3" />
        <span className="sr-only">Dismiss</span>
      </Button>
    </div>
  );
}
