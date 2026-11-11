// Prepare directory/file reviews without committing until the host accepts their payload size.
import * as fs from 'fs';
import type { DiffLoadPayload, ReviewSourceIdentity, PayloadStats } from './types';
import type { ReviewSession } from './review-session';
import { commitDiffData, preparePayload } from './review-session';
import { scanDirectory, scanFile } from './directory-scanner';
import { computePayloadStats, countTotalLines } from './payload-sizing';
import { resolveLocalSourceIdentity } from './source-identity';

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
  directoryPath: string
): Promise<ReviewStartResult> {
  console.error('[review] Starting directory review for:', directoryPath);

  // Check if the path is a file (not a directory)
  let isFile = false;
  try {
    isFile = fs.statSync(directoryPath).isFile();
  } catch {
    // Failed to stat — proceed as directory
  }

  // Scan diagnostics ride on the payload so a failed load never looks empty.
  const scan = isFile
    ? await scanFile(directoryPath)
    : await scanDirectory(directoryPath, session.config?.ignore ?? []);
  const type = isFile ? 'file' : 'directory';
  const payload: DiffLoadPayload = {
    files: scan.files,
    source: { type, sourcePath: directoryPath },
    ...(scan.diagnostics.length > 0 ? { diagnostics: scan.diagnostics } : {}),
  };
  const identity = resolveLocalSourceIdentity({ type, sourcePath: directoryPath });

  // Large payload guard — skipped entirely when there is no config.
  if (!session.config) {
    return { payload, identity, stats: null, exceedsThresholds: false };
  }
  const stats = computePayloadStats(
    payload.files.length,
    countTotalLines(payload.files),
    session.config
  );
  return { payload, identity, stats, exceedsThresholds: stats.exceedsAny };
}

/**
 * Commit a prepared review payload to the session, once the caller has decided
 * it should proceed. Returns the payload to hand to the transport.
 */
export function commitReviewStart(
  session: Pick<ReviewSession, 'diffData' | 'reviewedPaths' | 'sourceIdentity'>,
  payload: DiffLoadPayload,
  identity: ReviewSourceIdentity | null
): DiffLoadPayload {
  commitDiffData(session, payload, identity);
  return preparePayload(payload);
}
