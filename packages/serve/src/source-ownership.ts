// A submission describes the loaded review; the browser cannot select a new source.
import { ReviewPublishError } from '@self-review/core';
import type { DiffSource, ReviewSession, ReviewState } from '@self-review/core';

function sameSource(loaded: DiffSource, submitted: DiffSource): boolean {
  if (loaded.type !== submitted.type) return false;
  switch (loaded.type) {
    case 'git':
      return (
        submitted.type === 'git' &&
        submitted.repository === loaded.repository &&
        submitted.gitDiffArgs === loaded.gitDiffArgs
      );
    case 'directory':
    case 'file':
      return (
        (submitted.type === 'directory' || submitted.type === 'file') &&
        submitted.sourcePath === loaded.sourcePath
      );
    default:
      return false;
  }
}

export function ownedReviewState(
  session: ReviewSession,
  state: ReviewState,
  outputPath: string
): ReviewState {
  if (!session.diffData || !sameSource(session.diffData.source, state.source)) {
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
