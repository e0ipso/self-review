import {
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { DiffLoadPayload, ReviewComment } from '@self-review/types';
import { ReviewLifecycleContext } from '../context/ReviewLifecycleContext';
import type { ReviewAdapter } from '../adapter';
import {
  isPlaceholderSource,
  reviewSessionIdentity,
  type ReviewSessionStore,
} from '../context/review-session';

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)) || 'The host request failed.';
}

/** Owns host request ordering; the session reducer owns the data those requests deliver. */
export function useReviewHost(
  store: ReviewSessionStore,
  adapter: ReviewAdapter | null,
  staticDiff: boolean,
  initialComments?: ReviewComment[]
) {
  const notifyIdentity = useContext(ReviewLifecycleContext);
  const mounted = useRef(false);
  const pushVersion = useRef(0);
  const loadRequest = useRef(0);
  const resumeRequest = useRef(0);
  const resumeOwner = useRef<{ session: number; snapshot: number; settled: boolean } | null>(null);

  const loading = useRef(false);
  const initialLoadSettled = useRef(false);
  const comments = useRef(initialComments);
  comments.current = initialComments;

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadRequest.current++;
      resumeRequest.current++;
      resumeOwner.current = null;
      loading.current = false;
    };
  }, []);

  const loadResume = useCallback(
    async (skipPushed = false) => {
      if (!adapter?.loadResumedReview) return;
      const state = store.getSnapshot();
      const previous = resumeOwner.current;
      if (
        skipPushed &&
        previous?.session === state.sessionId &&
        (previous.snapshot === state.snapshotId || (previous.settled && !state.resumePending))
      )
        return;
      const request = ++resumeRequest.current;
      const owner = { session: state.sessionId, snapshot: state.snapshotId, settled: false };
      resumeOwner.current = owner;
      store.dispatch({ type: 'resume-start' });
      const current = () =>
        mounted.current &&
        request === resumeRequest.current &&
        owner.session === store.getSnapshot().sessionId &&
        owner.snapshot === store.getSnapshot().snapshotId;
      try {
        const resumed = await adapter.loadResumedReview();
        if (resumed === undefined) throw new Error('The host did not acknowledge saved feedback.');
        if (current()) {
          owner.settled = true;
          store.dispatch({ type: 'resume', resumed });
        }
      } catch (error) {
        if (current()) {
          owner.settled = true;
          store.dispatch({ type: 'resume-error', message: message(error) });
        }
      }
    },
    [adapter, store]
  );

  const receive = useCallback(
    (payload: DiffLoadPayload, fromPull = false) => {
      const previous = store.getSnapshot();
      // Clear the previous guide before a host can synchronously deliver the next guide.
      if (!isPlaceholderSource(payload.source))
        notifyIdentity?.(reviewSessionIdentity(payload.source, payload.remote));
      store.dispatch({
        type: 'payload',
        payload,
        initialComments: comments.current,
        resumePending: !!(
          (!fromPull && adapter?.onResumeLoad) ||
          (adapter?.loadResumedReview &&
            (fromPull ||
              !initialLoadSettled.current ||
              (isPlaceholderSource(previous.diffSource) && previous.resumePending)))
        ),
      });
      // The desktop welcome request is deliberately answered after its replacement diff.
      const owner = resumeOwner.current;
      if (isPlaceholderSource(previous.diffSource) && owner?.session === previous.sessionId) {
        owner.session = store.getSnapshot().sessionId;
        owner.snapshot = store.getSnapshot().snapshotId;
      }
    },
    [store, notifyIdentity, adapter]
  );

  // Subscribe before requesting: a host may synchronously push while loadDiff starts.
  useEffect(() => {
    if (staticDiff || !adapter?.onDiffLoad) return;
    return adapter.onDiffLoad(payload => {
      pushVersion.current++;
      const previous = store.getSnapshot();
      receive(payload);
      // A pull is paired with the initial diff; only same-session snapshot changes may restart it.
      // Later sessions receive their feedback through onResumeLoad, never a cached initial pull.
      if (
        previous.sessionId === store.getSnapshot().sessionId &&
        previous.resumePending &&
        resumeOwner.current
      )
        void loadResume(true);
    });
  }, [adapter, staticDiff, receive, loadResume]);

  useEffect(() => {
    if (!adapter?.onResumeLoad) return;
    let active = true;
    const unsubscribe = adapter.onResumeLoad(resumed => {
      if (!active || !mounted.current) return;
      ++resumeRequest.current;
      const state = store.getSnapshot();
      resumeOwner.current = { session: state.sessionId, snapshot: state.snapshotId, settled: true };
      store.dispatch({ type: 'resume', resumed });
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [adapter, store]);

  const load = useCallback(async () => {
    if (!adapter || staticDiff || loading.current) return;
    loading.current = true;
    const request = ++loadRequest.current;
    const arrival = pushVersion.current;
    store.dispatch({ type: 'load-error', message: null });
    try {
      const payload = await adapter.loadDiff();
      if (!mounted.current || request !== loadRequest.current) return;
      initialLoadSettled.current = true;
      if (pushVersion.current === arrival) receive(payload, true);
      // A duplicate delivery still hydrates resume once; a newer push's files always win.
      if (store.getSnapshot().identity === reviewSessionIdentity(payload.source, payload.remote))
        await loadResume(true);
      else if (!adapter.onResumeLoad && store.getSnapshot().resumePending)
        // The initial pull belongs to another source. This pushed session has no resume channel.
        store.dispatch({ type: 'resume', resumed: null });
    } catch (error) {
      if (mounted.current && request === loadRequest.current && pushVersion.current === arrival) {
        store.dispatch({ type: 'load-error', message: message(error) });
      }
    } finally {
      if (request === loadRequest.current) loading.current = false;
    }
  }, [adapter, staticDiff, store, receive, loadResume]);

  const snapshot = useSyncExternalStore(
    store.subscribe,
    () => store.getSnapshot().snapshotId,
    () => store.getSnapshot().snapshotId
  );
  useEffect(() => {
    if (!staticDiff) void load();
  }, [staticDiff, load]);
  useEffect(() => {
    if (staticDiff) void loadResume(true);
  }, [staticDiff, loadResume, snapshot]);
  return { retryLoad: load, retryResume: loadResume };
}
