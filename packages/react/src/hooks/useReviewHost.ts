import {
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { DiffFile, DiffSource, ReviewComment } from '@self-review/types';
import { ReviewLifecycleContext } from '../context/ReviewLifecycleContext';
import type { ReviewAdapter } from '../adapter';
import type { ReviewSessionStore } from '../context/review-session';
import { createReviewSessionController } from '../context/review-session-controller';

/** Connect React's lifetime and inputs to the session's request owner. */
export function useReviewHost(
  store: ReviewSessionStore,
  adapter: ReviewAdapter | null,
  staticDiff: boolean,
  initialComments?: ReviewComment[],
  staticInput?: { files?: DiffFile[]; source?: DiffSource }
) {
  const controller = useMemo(
    () => createReviewSessionController(store, adapter, staticDiff),
    [store, adapter, staticDiff]
  );
  const notifyIdentity = useContext(ReviewLifecycleContext);
  useLayoutEffect(() => controller.activate(), [controller]);
  const inputFiles = staticInput?.files;
  const inputSource = staticInput?.source;
  const staticFiles = useRef(inputFiles);
  useLayoutEffect(() => {
    controller.hydrate(initialComments);
    if (!inputFiles || inputFiles === staticFiles.current) return;
    staticFiles.current = inputFiles;
    controller.updateStatic(inputFiles, inputSource);
  }, [controller, inputFiles, inputSource, initialComments]);
  useEffect(() => controller.connect(notifyIdentity), [controller, notifyIdentity]);
  const snapshot = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().snapshotId,
    () => store.getSnapshot().snapshotId
  );
  useEffect(() => {
    if (staticDiff) void controller.retryResume(true);
  }, [controller, staticDiff, snapshot]);
  return { retryLoad: controller.retryLoad, retryResume: controller.retryResume, controller };
}
