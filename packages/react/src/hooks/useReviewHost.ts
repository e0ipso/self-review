import { useCallback, useContext, useEffect, useLayoutEffect, useRef } from 'react';
import type { DiffLoadPayload, ReviewComment } from '@self-review/types';
import { ReviewLifecycleContext } from '../context/ReviewLifecycleContext';
import type { ReviewAdapter } from '../adapter';
import {
  isPlaceholderSource,
  reviewSessionIdentity,
  type ReviewSessionStore,
} from '../context/review-session';

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
  const resumeOwner = useRef<number | null>(null);
  const loading = useRef(false);
  const comments = useRef(initialComments);
  comments.current = initialComments;

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadRequest.current++;
      resumeRequest.current++;
      loading.current = false;
    };
  }, []);

  const loadResume = useCallback(async () => {
    if (!adapter?.loadResumedReview) return;
    const request = ++resumeRequest.current;
    resumeOwner.current = store.getSnapshot().sessionId;
    store.dispatch({ type: 'resume-error', message: null });
    const current = () =>
      mounted.current &&
      request === resumeRequest.current &&
      resumeOwner.current === store.getSnapshot().sessionId;
    try {
      const resumed = await adapter.loadResumedReview();
      if (current()) store.dispatch({ type: 'resume', resumed });
    } catch (error) {
      if (current()) store.dispatch({ type: 'resume-error', message: message(error) });
    }
  }, [adapter, store]);

  const receive = useCallback(
    (payload: DiffLoadPayload) => {
      const previous = store.getSnapshot();
      // Clear the previous guide before a host can synchronously deliver the next guide.
      if (!isPlaceholderSource(payload.source))
        notifyIdentity?.(reviewSessionIdentity(payload.source, payload.remote));
      store.dispatch({ type: 'payload', payload, initialComments: comments.current });
      if (isPlaceholderSource(previous.diffSource) && resumeOwner.current === previous.sessionId) {
        resumeOwner.current = store.getSnapshot().sessionId;
      }
    },
    [store, notifyIdentity]
  );

  // Subscribe before requesting: a host may synchronously push while loadDiff starts.
  useEffect(() => {
    if (staticDiff || !adapter?.onDiffLoad) return;
    return adapter.onDiffLoad(payload => {
      pushVersion.current++;
      receive(payload);
    });
  }, [adapter, staticDiff, receive]);

  const load = useCallback(async () => {
    if (!adapter || staticDiff || loading.current) return;
    loading.current = true;
    const request = ++loadRequest.current;
    const arrival = pushVersion.current;
    store.dispatch({ type: 'load-error', message: null });
    try {
      const payload = await adapter.loadDiff();
      if (!mounted.current || request !== loadRequest.current) return;
      if (pushVersion.current === arrival) receive(payload);
      // A duplicate delivery still hydrates resume once; a newer push's files always win.
      if (store.getSnapshot().identity === reviewSessionIdentity(payload.source, payload.remote))
        await loadResume();
    } catch (error) {
      if (mounted.current && request === loadRequest.current && pushVersion.current === arrival) {
        store.dispatch({ type: 'load-error', message: message(error) });
      }
    } finally {
      if (request === loadRequest.current) loading.current = false;
    }
  }, [adapter, staticDiff, store, receive, loadResume]);

  useEffect(() => {
    if (staticDiff) void loadResume();
    else void load();
  }, [staticDiff, load, loadResume]);
  return { retryLoad: load, retryResume: loadResume };
}
