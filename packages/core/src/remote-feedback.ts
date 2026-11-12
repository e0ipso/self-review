// Pure merge, provenance and drift policy for remote feedback. No resource acquisition.
import type { ReviewComment, ReviewState, RemoteSessionInfo, RemoteDriftInfo } from './types';

/**
 * Merge fetched forge threads into a resumed document's comments. The
 * resumed document wins: a fetched thread whose root `remoteId` already
 * appears in the resumed comments is skipped (the resumed copy may carry
 * the user's added replies). Order: resumed comments first, then the
 * non-duplicate fetched threads in fetch order. Inputs are not mutated.
 */
export function mergeRemoteThreads(
  resumed: ReviewComment[],
  fetched: ReviewComment[]
): ReviewComment[] {
  const resumedRemoteIds = new Set(
    resumed.map(c => c.remoteId).filter((id): id is string => id !== undefined)
  );
  return [
    ...resumed,
    ...fetched.filter(c => c.remoteId === undefined || !resumedRemoteIds.has(c.remoteId)),
  ];
}

/**
 * Return a copy of the state carrying this session's remote provenance, so
 * "Finish Review" writes the `remote-*` root attributes. Always records the
 * live session values: the saved document describes the diff that was
 * actually reviewed.
 */
export function applyRemoteProvenance(state: ReviewState, remote: RemoteSessionInfo): ReviewState {
  return {
    ...state,
    // The three source shapes are mutually exclusive in the document: the
    // remote-* attributes ARE the source, so the in-session git source
    // (the materialized clone) must not leak into the saved review. The
    // welcome source emits no source attributes, mirroring fetch-comments.
    source: { type: 'welcome' },
    remoteUrl: remote.remoteUrl,
    remoteBaseSha: remote.remoteBaseSha,
    remoteHeadSha: remote.remoteHeadSha,
    remoteForge: remote.remoteForge,
  };
}

/**
 * Compare a resumed document's recorded `remote-head-sha` with the live
 * head from materialization. Returns `null` when the document recorded no
 * head SHA (nothing to compare).
 */
export function computeRemoteDrift(
  recordedHeadSha: string | undefined,
  liveHeadSha: string
): RemoteDriftInfo | null {
  if (recordedHeadSha === undefined) {
    return null;
  }
  return {
    recordedHeadSha,
    liveHeadSha,
    drifted: recordedHeadSha !== liveHeadSha,
  };
}
