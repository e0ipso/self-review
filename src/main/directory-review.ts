import type { IpcMainInvokeEvent } from 'electron';
import { replaceReviewAsync } from './replacement-delivery';
import type { createIpcBoundary } from './ipc-boundary';
import type { DesktopReviewOperations } from './review-operations';
import type { ReviewPresentation } from './presentation';
import type { ReviewTransition } from './review-transition';
import type { DirectorySelection } from './directory-selection';

export async function startDirectoryReview(
  event: IpcMainInvokeEvent,
  directoryPath: string,
  signal: AbortSignal,
  review: Pick<
    DesktopReviewOperations,
    'prepareDirectoryReview' | 'getConfig' | 'commitReviewStart'
  >,
  boundary: ReturnType<typeof createIpcBoundary>,
  transition: ReviewTransition,
  selection: DirectorySelection,
  presentation: Pick<ReviewPresentation, 'confirmPayload'>
) {
  const current = boundary.capture(event);
  const opening = transition.begin();
  try {
    const authorizedPath = await selection.authorize(event, directoryPath);
    const { payload, identity, loadedReview } = await review.prepareDirectoryReview(
      authorizedPath,
      signal
    );
    current();
    opening.assertCurrent();
    signal.throwIfAborted();
    // Scan only the authorized physical root while retaining the reviewer's displayed path.
    if (payload.source.type === 'directory') payload.source.sourcePath = directoryPath;
    const config = review.getConfig();
    if (config && !(await presentation.confirmPayload(payload, config, boundary.assertPeer(event))))
      return;

    await selection.authorize(event, directoryPath);
    current();
    opening.assertCurrent();
    signal.throwIfAborted();
    await replaceReviewAsync(
      { payload, guide: null, resume: { comments: [], viewedFiles: [] } },
      {
        signal,
        assertCurrent: current,
        send: (channel, value) => boundary.assertPeer(event).webContents.send(channel, value),
      },
      () => {
        opening.assertCurrent();
        review.commitReviewStart(payload, identity, loadedReview);
      },
      opening.assertCurrent
    );

    if (payload.source.type === 'file') {
      console.error('[ipc] File review started:', payload.files.length, 'files');
    } else {
      console.error(
        '[ipc] Directory review started:',
        payload.source.type,
        'mode with',
        payload.files.length,
        'files'
      );
    }
  } finally {
    opening.finish();
  }
}
