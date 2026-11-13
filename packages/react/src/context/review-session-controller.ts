import type { DiffFile, DiffLoadPayload, DiffSource, ReviewComment } from '@self-review/types';
import type { ReviewAdapter } from '../adapter';
import {
  expandContext,
  canReadResumedReview,
  loadInitialDiff,
  loadInitialResumedReview,
} from '../read-service';
import {
  isPlaceholderSource,
  reviewSessionIdentity,
  sameRemoteSnapshot,
  type ReviewSessionStore,
} from './review-session';

function message(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)) || 'The host request failed.';
}

type ResumeOwner = { session: number; snapshot: number; settled: boolean };
type SessionHost = Pick<
  ReviewAdapter,
  | 'loadDiff'
  | 'loadResumedReview'
  | 'initialReads'
  | 'onDiffLoad'
  | 'onResumeLoad'
  | 'expandContext'
> & { reads?: Pick<NonNullable<ReviewAdapter['reads']>, 'expandContext'> };

/** Owns requests for one provider. Tickets and snapshot ownership are checked before every commit.
 * React only connects/disposes this owner; the store owns feedback and reconciliation.
 * Reads may be cancelled. Apply and publication never pass through this owner.
 */
export function createReviewSessionController(
  store: ReviewSessionStore,
  host: SessionHost | null,
  staticDiff = false
) {
  let active = true;
  let pushed: object = {};
  let loadTicket: object | null = null;
  let resumeOwner: ResumeOwner | null = null;
  let diffRead: AbortController | null = null;
  let resumeRead: AbortController | null = null;
  // Cancellation requests do not settle a host promise. Each invocation awaits its admitted read.
  const initialReads = new Set<AbortController>();
  const cancelInitialReads = () => {
    initialReads.forEach(controller => controller.abort());
  };
  let initialLoadSettled = false;
  let resumeSnapshot: Pick<DiffLoadPayload, 'source' | 'remote'> | null = null;
  let initialComments: ReviewComment[] | undefined;
  const reads = new Set<AbortController>();
  const abortReads = () => {
    reads.forEach(controller => controller.abort());
    reads.clear();
  };

  const resume = async (skipPushed = false) => {
    if (!active || !host || !canReadResumedReview(host)) return;
    const state = store.getSnapshot();
    if (resumeSnapshot?.remote && !sameRemoteSnapshot(state, resumeSnapshot)) {
      if (!skipPushed)
        store.dispatch({
          type: 'resume-error',
          message:
            'Saved feedback belongs to an earlier remote snapshot. The host must supply feedback for the current snapshot.',
        });
      return;
    }
    if (!resumeSnapshot && !isPlaceholderSource(state.diffSource))
      resumeSnapshot = {
        source: state.diffSource,
        ...(state.remote ? { remote: state.remote } : {}),
      };
    if (
      skipPushed &&
      resumeOwner?.session === state.sessionId &&
      (resumeOwner.snapshot === state.snapshotId || (resumeOwner.settled && !state.resumePending))
    )
      return;
    resumeRead?.abort();
    const controller = new AbortController();
    resumeRead = controller;
    initialReads.add(controller);
    const owner = { session: state.sessionId, snapshot: state.snapshotId, settled: false };
    resumeOwner = owner;
    store.dispatch({ type: 'resume-start' });
    const current = () =>
      active &&
      resumeOwner === owner &&
      owner.session === store.getSnapshot().sessionId &&
      owner.snapshot === store.getSnapshot().snapshotId;
    try {
      const resumed = await loadInitialResumedReview(host, controller.signal);
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
    } finally {
      initialReads.delete(controller);
      if (resumeRead === controller) resumeRead = null;
    }
  };

  let notifyIdentity: ((identity: string) => void) | null = null;
  const receive = (payload: DiffLoadPayload, fromPull = false) => {
    const previous = store.getSnapshot();
    if (!resumeSnapshot && !isPlaceholderSource(payload.source))
      resumeSnapshot = { source: payload.source, remote: payload.remote };
    if (!isPlaceholderSource(payload.source))
      notifyIdentity?.(reviewSessionIdentity(payload.source, payload.remote));
    store.dispatch({
      type: 'payload',
      payload,
      initialComments,
      resumePending: !!(
        (!fromPull && host?.onResumeLoad) ||
        (canReadResumedReview(host) &&
          (fromPull ||
            !initialLoadSettled ||
            (isPlaceholderSource(previous.diffSource) && previous.resumePending)))
      ),
    });
    // Desktop answers the welcome screen's pending resume after pushing its real diff.
    if (isPlaceholderSource(previous.diffSource) && resumeOwner?.session === previous.sessionId) {
      resumeOwner.session = store.getSnapshot().sessionId;
      resumeOwner.snapshot = store.getSnapshot().snapshotId;
    }
    const next = store.getSnapshot();
    if (
      resumeOwner &&
      (resumeOwner.session !== next.sessionId || resumeOwner.snapshot !== next.snapshotId)
    )
      resumeRead?.abort();
  };

  const load = async () => {
    if (!active || !host || staticDiff) return;
    if (loadTicket) {
      if (!host.initialReads?.loadDiff) return;
      diffRead?.abort();
    }
    const controller = new AbortController();
    diffRead = controller;
    initialReads.add(controller);
    const ticket = {};
    loadTicket = ticket;
    const arrival = pushed;
    store.dispatch({ type: 'load-error', message: null });
    try {
      const payload = await loadInitialDiff(host, controller.signal);
      if (!active || loadTicket !== ticket) return;
      initialLoadSettled = true;
      // The pull identifies what the legacy loader can return, even if a newer push arrived first.
      if (!isPlaceholderSource(payload.source))
        resumeSnapshot = { source: payload.source, remote: payload.remote };
      if (pushed === arrival) receive(payload, true);
      const state = store.getSnapshot();
      // A legacy initial resume belongs to the initial snapshot, even when the PR is the same.
      if (
        state.identity === reviewSessionIdentity(payload.source, payload.remote) &&
        sameRemoteSnapshot(state, payload)
      )
        await resume(true);
      else if (!host.onResumeLoad && state.resumePending)
        store.dispatch({ type: 'resume', resumed: null });
    } catch (error) {
      if (active && loadTicket === ticket && pushed === arrival)
        store.dispatch({ type: 'load-error', message: message(error) });
    } finally {
      initialReads.delete(controller);
      if (diffRead === controller) diffRead = null;
      if (loadTicket === ticket) loadTicket = null;
    }
  };

  return {
    retryLoad: load,
    retryResume: resume,
    hydrate(comments?: ReviewComment[]) {
      initialComments = comments;
      store.dispatch({ type: 'hydrate', comments });
    },
    updateStatic(files: DiffFile[], source?: DiffSource) {
      receive({ files, source: source ?? store.getSnapshot().diffSource });
    },
    activate() {
      active = true;
      let snapshot = store.getSnapshot().snapshotId;
      const unsubscribe = store.subscribe(() => {
        const next = store.getSnapshot().snapshotId;
        if (snapshot !== next) abortReads();
        snapshot = next;
      });
      return () => {
        active = false;
        loadTicket = null;
        resumeOwner = null;
        unsubscribe();
        cancelInitialReads();
        abortReads();
      };
    },
    connect(onIdentity?: ((identity: string) => void) | null) {
      notifyIdentity = onIdentity ?? null;
      let connected = true;
      // Subscribe before requesting: a host may synchronously push while loadDiff starts.
      const unsubscribeDiff = !staticDiff
        ? host?.onDiffLoad?.(payload => {
            if (!active || !connected) return;
            pushed = {};
            const previous = store.getSnapshot();
            // Before the first response, a push may echo it or replace an unknown initial
            // snapshot. Retain that response to identify what cached feedback belongs to.
            const supersedesPull = !!(
              initialLoadSettled &&
              loadTicket &&
              host?.initialReads?.loadDiff
            );
            if (supersedesPull) {
              diffRead?.abort();
              loadTicket = null;
            }
            receive(payload);
            const state = store.getSnapshot();
            if (previous.sessionId !== state.sessionId || !previous.resumePending || !resumeOwner)
              return;
            if (sameRemoteSnapshot(previous, payload)) void resume(true);
            else {
              // Cached initial feedback cannot be reinterpreted against a newer PR snapshot.
              resumeRead?.abort();
              resumeOwner = null;
              if (!host?.onResumeLoad) store.dispatch({ type: 'resume', resumed: null });
            }
          })
        : undefined;
      const unsubscribeResume = host?.onResumeLoad?.(resumed => {
        if (!active || !connected) return;
        const state = store.getSnapshot();
        resumeRead?.abort();
        resumeOwner = { session: state.sessionId, snapshot: state.snapshotId, settled: true };
        store.dispatch({ type: 'resume', resumed });
      });
      if (staticDiff) void resume(true);
      else void load();
      return () => {
        connected = false;
        unsubscribeDiff?.();
        unsubscribeResume?.();
      };
    },
    /** Commands bind to a single snapshot, including before React observes a replacement. */
    capture() {
      const { sessionId, snapshotId } = store.getSnapshot();
      const current = () =>
        active &&
        store.getSnapshot().sessionId === sessionId &&
        store.getSnapshot().snapshotId === snapshotId;
      return {
        current,
        async expandFileContext(filePath: string, contextLines: number) {
          if (!(host?.reads?.expandContext || host?.expandContext) || !current()) return null;
          const controller = new AbortController();
          reads.add(controller);
          try {
            const result = await expandContext(host, { filePath, contextLines }, controller.signal);
            return current() && result
              ? { hunks: result.hunks, totalLines: result.totalLines }
              : null;
          } catch (error) {
            if (!controller.signal.aborted && current())
              console.error('[ReviewContext] Failed to expand context:', error);
            return null;
          } finally {
            reads.delete(controller);
          }
        },
      };
    },
  };
}
export type ReviewSessionController = ReturnType<typeof createReviewSessionController>;
