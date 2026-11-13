// Prepare directory/file reviews without committing until the host accepts their payload size.
import { nodeScanFsLayer } from './node-scan-fs';
import { admitSyntheticSnapshot, type LoadedReview } from './loaded-snapshot';
import { isolatedReporter } from './effect-diagnostics';
import { checkLoadingCancelled } from './local-loading-lifetime';
import type { SourceScanOptions } from './directory-scanner';
import type { DiffLoadPayload, ReviewSourceIdentity, PayloadStats } from './types';
import type { ReviewSession } from './review-session';
import { commitDiffData, commitLoadedReview, preparePayload } from './review-session';
import { scanDirectory, scanFile } from './directory-scanner';
import { computePayloadStats, countTotalLines } from './payload-sizing';
import { resolveLocalSourceIdentityAsync } from './source-identity';

/**
 * What a review start produced: the payload built from the scanned path, the
 * stats it was measured against (null when the session has no config, in which
 * case no thresholds apply), and whether those stats exceeded a threshold.
 *
 * The payload is deliberately *not* stored on the session: the caller may still
 * need to abandon it (a user declining a large review keeps the review they
 * were already looking at), so committing it is the caller's decision.
 */
export interface ReviewStartResult {
  payload: DiffLoadPayload;
  identity: ReviewSourceIdentity;
  /** Host-local evidence to pass to commitLoadedReview. Never put this on a wire payload. */
  loadedReview?: LoadedReview;
  stats: PayloadStats | null;
  exceedsThresholds: boolean;
}

/**
 * Scan a picked path and build the diff payload for a directory (or single
 * file) review, measured against the session's large-payload thresholds.
 * Nothing is stored on the session — see `ReviewStartResult`.
 */
export async function prepareDirectoryReview(
  session: Pick<ReviewSession, 'config'>,
  directoryPath: string,
  options: SourceScanOptions = {}
): Promise<ReviewStartResult> {
  checkLoadingCancelled(options.signal);
  const reportDiagnostic = isolatedReporter(options.reportDiagnostic);
  const scanFs = options.scanFs ?? nodeScanFsLayer;
  reportDiagnostic('[review] Starting directory review for:', directoryPath);

  // Check if the path is a file (not a directory)
  let isFile = false;
  try {
    isFile = (await scanFs.stat(directoryPath)).isFile();
  } catch {
    // Failed to stat — proceed as directory
  }

  checkLoadingCancelled(options.signal);

  // Scan diagnostics ride on the payload so a failed load never looks empty.
  const scan = isFile
    ? await scanFile(directoryPath, { ...options, reportDiagnostic })
    : await scanDirectory(directoryPath, session.config?.ignore ?? [], {
        ...options,
        reportDiagnostic,
      });
  checkLoadingCancelled(options.signal);
  const type = isFile ? 'file' : 'directory';
  const payload: DiffLoadPayload = {
    files: scan.files,
    source: { type, sourcePath: directoryPath },
    ...(scan.diagnostics.length > 0 ? { diagnostics: scan.diagnostics } : {}),
  };
  const identity = await resolveLocalSourceIdentityAsync(
    { type, sourcePath: directoryPath },
    scanFs,
    options.signal
  );
  checkLoadingCancelled(options.signal);
  const loadedReview = admitSyntheticSnapshot(identity, scan.files);

  // Large payload guard — skipped entirely when there is no config.
  if (!session.config) {
    return { payload, identity, loadedReview, stats: null, exceedsThresholds: false };
  }
  const stats = computePayloadStats(
    payload.files.length,
    countTotalLines(payload.files),
    session.config
  );
  return { payload, identity, loadedReview, stats, exceedsThresholds: stats.exceedsAny };
}

/**
 * Commit a prepared review payload to the session, once the caller has decided
 * it should proceed. Returns the payload to hand to the transport.
 */
export function commitReviewStart(
  session: Pick<ReviewSession, 'diffData' | 'reviewedPaths' | 'sourceIdentity' | 'loadedReview'>,
  payload: DiffLoadPayload,
  identity: ReviewSourceIdentity | null,
  loadedReview: LoadedReview | undefined = undefined
): DiffLoadPayload {
  if (loadedReview) commitLoadedReview(session, payload, loadedReview);
  else commitDiffData(session, payload, identity);
  return preparePayload(payload);
}
