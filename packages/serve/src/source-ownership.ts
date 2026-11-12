// A submission describes the loaded review; the browser cannot select a new source.
import { sameDiffSource } from '@self-review/core/validation';
import { ReviewPublishError } from '@self-review/core';
import type { ReviewSession, ReviewState } from '@self-review/core';

export function ownedReviewState(
  session: ReviewSession,
  state: ReviewState,
  outputPath: string
): ReviewState {
  if (
    !session.diffData ||
    session.diffData.source.type === 'welcome' ||
    session.diffData.source.type === 'loading' ||
    !sameDiffSource(session.diffData.source, state.source)
  ) {
    throw new ReviewPublishError(
      'validation-failed',
      outputPath,
      'The submitted source does not match the loaded review.'
    );
  }
  // Keep source extensions, but take remote provenance exclusively from the owned load.
  const {
    remoteUrl: _url,
    remoteForge: _forge,
    remoteBaseSha: _base,
    remoteHeadSha: _head,
    ...local
  } = state;
  const remote = session.diffData.remote;
  return remote
    ? {
        ...local,
        remoteUrl: remote.remoteUrl,
        remoteForge: remote.remoteForge,
        remoteBaseSha: remote.remoteBaseSha,
        remoteHeadSha: remote.remoteHeadSha,
      }
    : local;
}
