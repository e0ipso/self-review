// src/serve-client/finish.ts
// The finish control's submit flow.
//
// The React package owns no "submit" UI: `ReviewPanel` exposes the review
// state through an imperative handle and the host decides what to do with it.
// In the desktop app that host is `src/renderer/App.tsx`, which pushes the
// state over IPC and quits; here it is `main.tsx`, which POSTs it and waits.
//
// Kept out of the component because it is the one path that must not lie: a
// failed write has to reach the reviewer as a failure, since the server stops
// on a successful submission and a browser tab reporting success over a review
// that was never written loses the whole session.

import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type { ReviewPanelHandle } from '../../packages/react/src/ReviewPanel';

/** What the finish control is currently reporting. */
export type FinishStatus =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'saved' }
  | { kind: 'error'; message: string };

/**
 * Read the review state from the panel and submit it.
 *
 * Never throws: every outcome is a status the control can render.
 */
export async function finishReview(
  handle: ReviewPanelHandle | null,
  adapter: ReviewAdapter
): Promise<FinishStatus> {
  const state = handle?.getReviewState();
  if (!state) {
    return { kind: 'error', message: 'The review panel is not ready yet.' };
  }
  if (!adapter.submitReview) {
    return { kind: 'error', message: 'This session cannot save a review.' };
  }

  try {
    await adapter.submitReview(state);
    return { kind: 'saved' };
  } catch (error) {
    return {
      kind: 'error',
      message: error instanceof Error ? error.message : String(error),
    };
  }
}
