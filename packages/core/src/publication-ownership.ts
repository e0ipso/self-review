// Pure publication ownership policy. Hosts translate refusal with their installed error classes.
import type { DiffLoadPayload, DiffSource, RemoteSessionInfo, ReviewState } from './types';
import { sameDiffSource } from './same-diff-source';

type LoadedReview = Pick<DiffLoadPayload, 'source' | 'remote'>;
type Provenance = Pick<
  RemoteSessionInfo,
  'remoteUrl' | 'remoteForge' | 'remoteBaseSha' | 'remoteHeadSha'
>;

export interface PublicationOwnership {
  readonly loaded: LoadedReview;
  readonly source: DiffSource;
  readonly remote: Provenance | undefined;
}

function provenance(remote: RemoteSessionInfo | undefined): Provenance | undefined {
  if (!remote) return undefined;
  return {
    remoteUrl: remote.remoteUrl,
    remoteForge: remote.remoteForge,
    remoteBaseSha: remote.remoteBaseSha,
    remoteHeadSha: remote.remoteHeadSha,
  };
}

/** Capture before asynchronous admission work; preserve the loaded object's public reference alias. */
export function capturePublicationOwnership(
  loaded: LoadedReview | null
): PublicationOwnership | null {
  if (!loaded || loaded.source.type === 'welcome' || loaded.source.type === 'loading') return null;
  return { loaded, source: { ...loaded.source }, remote: provenance(loaded.remote) };
}

/** Refuse absent, foreign or replaced loads, including in-place canonical source/provenance changes.
 * Keep legitimate state/source extensions; only the four host-owned provenance fields are replaced.
 */
export function normalizePublicationState(
  state: ReviewState,
  current: LoadedReview | null,
  admitted: PublicationOwnership | null
): ReviewState | null {
  if (
    !admitted ||
    !current ||
    current !== admitted.loaded ||
    !state.source ||
    !sameDiffSource(admitted.source, current.source) ||
    !sameDiffSource(admitted.source, state.source)
  )
    return null;
  const remote = provenance(current.remote);
  if (
    remote?.remoteUrl !== admitted.remote?.remoteUrl ||
    remote?.remoteForge !== admitted.remote?.remoteForge ||
    remote?.remoteBaseSha !== admitted.remote?.remoteBaseSha ||
    remote?.remoteHeadSha !== admitted.remote?.remoteHeadSha
  )
    return null;
  const {
    remoteUrl: _url,
    remoteForge: _forge,
    remoteBaseSha: _base,
    remoteHeadSha: _head,
    ...local
  } = state;
  return { ...local, ...admitted.remote };
}
