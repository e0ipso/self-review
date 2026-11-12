// Prepare directory/file reviews without committing until the host accepts their payload size.
import { dirname, resolve } from 'node:path';
import { nodeScanFsLayer } from './node-scan-fs';
import { isolatedReporter } from './effect-diagnostics';
import { checkLoadingCancelled } from './local-loading-lifetime';
import type { SourceScanOptions } from './directory-scanner';
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
  // A supplied scan owns path resolution as well as bytes; never consult the host disk for it.
  let identity: ReviewSourceIdentity;
  if (options.scanFs) {
    const canonical = (target: string) => scanFs.realpath(target).catch(() => resolve(target));
    identity = {
      mode: type,
      sourceRoot: await canonical(isFile ? dirname(directoryPath) : directoryPath),
      invocationCwd: process.cwd(),
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'none' },
      newSide: isFile
        ? { kind: 'file', path: await canonical(directoryPath) }
        : { kind: 'directory' },
    };
  } else {
    identity = resolveLocalSourceIdentity({ type, sourcePath: directoryPath });
  }
  checkLoadingCancelled(options.signal);

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
