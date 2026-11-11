// Destination selection and authorization for suggestion writes. Filesystem effects live here.
import * as fs from 'fs';
import path from 'path';
import type {
  SuggestionApplyRequest,
  SuggestionApplyOutcome,
  ApplyDestinationOutcome,
} from './types';
import type { ReviewSession } from './review-session';
import { resolveSourceBaseDir } from './review-session';
import { rootRelativeReviewedPath } from './source-identity';
import { applySuggestion, applySuggestionAsync } from './apply-suggestion';
import type {
  ApplySuggestionResult,
  ApplySuggestionAsyncOptions,
  ApplySuggestionRequest,
} from './apply-suggestion';
import { SafeFsError } from './safe-fs';

export type ApplySuggestionForSessionAsyncOptions = Omit<
  ApplySuggestionAsyncOptions,
  'beforeCommit' | 'validateDestination'
>;

type ApplySession = Pick<
  ReviewSession,
  'diffData' | 'sourceIdentity' | 'applyDestinationRoot' | 'reviewedPaths'
>;

/**
 * True when this session reviews a remote PR/MR that was materialized into
 * a temporary clone. That clone is removed when the app exits, so a write
 * into it is lost the moment the review ends (PRD Section 5.4.8).
 */
export function isTemporaryCloneSession(session: Pick<ReviewSession, 'diffData'>): boolean {
  return session.diffData?.remote?.temporaryClone === true;
}

/** Canonical form of a path, following symlinks when the path exists. */
function canonicalize(target: string): string {
  try {
    return fs.realpathSync(target);
  } catch {
    return path.resolve(target);
  }
}

/** True when `candidate` is `root` itself or sits anywhere beneath it. */
function isWithin(root: string, candidate: string): boolean {
  const relative = path.relative(canonicalize(root), canonicalize(candidate));
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

/**
 * The directory an apply may write into for this session, or null when the
 * session has none.
 *
 * For every review whose files sit in a place the user controls — a git
 * working tree, a scanned directory, a reused remote clone — that is the
 * root the reviewed paths are relative to, and no one is asked anything.
 *
 * A temporary-clone review is the one exception. Its files live in a
 * directory the app deletes on exit, so the clone is never a destination:
 * the answer is the directory the user named, and null until they name one.
 */
export function resolveApplyDestination(
  session: Pick<ReviewSession, 'diffData' | 'sourceIdentity' | 'applyDestinationRoot'>
): string | null {
  if (isTemporaryCloneSession(session)) {
    return session.applyDestinationRoot;
  }
  return resolveSourceBaseDir(session);
}

/**
 * Record the directory the user named as this session's apply destination.
 *
 * The caller supplies a path the user picked; this decides whether it can
 * be written into and stores it only if so. The temporary clone, and
 * anything inside it, is refused however it was reached — that directory
 * is gone when the review ends, which is the whole reason a destination is
 * asked for.
 */
export function setApplyDestination(
  session: Pick<ReviewSession, 'diffData' | 'sourceIdentity' | 'applyDestinationRoot'>,
  directoryPath: string
): ApplyDestinationOutcome {
  if (!path.isAbsolute(directoryPath)) {
    return {
      status: 'rejected',
      reason: 'destination-not-absolute',
      detail: 'Pick a destination by its full path.',
    };
  }

  let isDirectory = false;
  try {
    isDirectory = fs.statSync(directoryPath).isDirectory();
  } catch {
    isDirectory = false;
  }
  if (!isDirectory) {
    return {
      status: 'rejected',
      reason: 'destination-not-a-directory',
      detail: 'That destination is not a directory that exists.',
    };
  }

  const clonePath = isTemporaryCloneSession(session) ? resolveSourceBaseDir(session) : null;
  if (clonePath && isWithin(clonePath, directoryPath)) {
    return {
      status: 'rejected',
      reason: 'destination-inside-temporary-clone',
      detail:
        'That directory is inside the temporary clone, which is deleted when the review ends.',
    };
  }

  session.applyDestinationRoot = canonicalize(directoryPath);
  console.error(`[suggestion:apply] destination set for this session`);
  return { status: 'chosen', destinationRoot: session.applyDestinationRoot };
}

/**
 * Apply one suggestion to the reviewed working file, or refuse and write
 * nothing. The engine does the work; this handler names the destination, which
 * the engine never derives, and authorizes the target.
 *
 * Authorization is membership in {@link ReviewSession.reviewedPaths}
 * (`not-reviewed` otherwise), so a resumed document or a client reaching this
 * handler cannot name an unreviewed file. The request is not bound to a
 * comment (the session keeps no registry of live suggestions); the binding is
 * the anchor plus the engine's byte-exact `originalCode` match.
 *
 * The engine gets the path through the identity's prefix, so a `--relative`
 * review of `sub/` writes `sub/<path>`, never the root's same-named file.
 *
 * A refusal travels as a value, never a thrown error.
 */
function prepareSessionApply(
  session: ApplySession,
  request: SuggestionApplyRequest
): { engineRequest: ApplySuggestionRequest } | SuggestionApplyOutcome {
  const destinationRoot = resolveApplyDestination(session);
  const identity = session.sourceIdentity;
  if (!destinationRoot || identity === null) {
    const temporary = isTemporaryCloneSession(session);
    return {
      status: 'refused',
      filePath: request.filePath,
      reason: temporary ? 'destination-required' : 'no-destination',
      detail: temporary
        ? 'This pull request was cloned into a temporary directory that is deleted when the review ends. Choose a destination directory to apply into.'
        : 'This review has no working directory to write into.',
    };
  }

  if (!session.reviewedPaths.has(request.filePath)) {
    console.error(`[suggestion:apply] ${request.filePath}: refused (not-reviewed)`);
    return {
      status: 'refused',
      filePath: request.filePath,
      reason: 'not-reviewed',
      detail: 'This file is not part of the reviewed diff, so nothing was written.',
    };
  }

  return {
    engineRequest: {
      destinationRoot,
      filePath: rootRelativeReviewedPath(identity, request.filePath),
      lineRange: request.lineRange,
      suggestion: request.suggestion,
    },
  };
}

/** Apply synchronously using the session's destination and reviewed-path authorization. */
export function applySuggestionForSession(
  session: ApplySession,
  request: SuggestionApplyRequest
): SuggestionApplyOutcome {
  const prepared = prepareSessionApply(session, request);
  if ('status' in prepared) return prepared;
  return projectApplyResult(request.filePath, applySuggestion(prepared.engineRequest));
}

/**
 * Bounded asynchronous Apply. Capture authorization before awaiting filesystem I/O and recheck
 * it synchronously just before rename. Replacing the loaded review, changing its identity or
 * selected destination, or removing membership refuses with file-changed and removes staging.
 * Cancellation rejects with signal.reason before commit, and a committed result stays applied.
 */
export async function applySuggestionForSessionAsync(
  session: ApplySession,
  request: SuggestionApplyRequest,
  options: ApplySuggestionForSessionAsyncOptions = {}
): Promise<SuggestionApplyOutcome> {
  options.signal?.throwIfAborted();
  request = {
    ...request,
    lineRange: request.lineRange && { ...request.lineRange },
    suggestion: { ...request.suggestion },
  };
  const prepared = prepareSessionApply(session, request);
  if ('status' in prepared) return prepared;
  const identity = session.sourceIdentity;
  const paths = session.reviewedPaths;
  const identityStamp = JSON.stringify(identity);
  const fileSource = JSON.stringify(identity?.fileSources?.get(request.filePath));
  const chosen = session.applyDestinationRoot;
  const temporary = isTemporaryCloneSession(session);
  const assertDestination = (physicalRoot: string) => {
    const destinationRoot = prepared.engineRequest.destinationRoot;
    if (
      physicalRoot !== path.resolve(destinationRoot) ||
      canonicalize(destinationRoot) !== physicalRoot ||
      (temporary && identity && isWithin(identity.sourceRoot, physicalRoot))
    ) {
      throw new SafeFsError(
        'identity-changed',
        request.filePath,
        'The Apply destination no longer belongs to this review.'
      );
    }
  };
  const result = await applySuggestionAsync(prepared.engineRequest, {
    ...options,
    validateDestination: assertDestination,
    beforeCommit() {
      assertDestination(prepared.engineRequest.destinationRoot);
      if (
        session.sourceIdentity !== identity ||
        session.reviewedPaths !== paths ||
        !session.reviewedPaths.has(request.filePath) ||
        JSON.stringify(session.sourceIdentity) !== identityStamp ||
        JSON.stringify(session.sourceIdentity?.fileSources?.get(request.filePath)) !== fileSource ||
        session.applyDestinationRoot !== chosen ||
        isTemporaryCloneSession(session) !== temporary ||
        resolveApplyDestination(session) !== prepared.engineRequest.destinationRoot
      ) {
        throw new SafeFsError(
          'identity-changed',
          request.filePath,
          'The review or its Apply destination changed before the write could commit.'
        );
      }
    },
  });
  return projectApplyResult(request.filePath, result);
}

function projectApplyResult(
  filePath: string,
  result: ApplySuggestionResult
): SuggestionApplyOutcome {
  console.error(
    `[suggestion:apply] ${filePath}: ${
      result.status === 'applied' ? 'applied' : `refused (${result.reason})`
    }`
  );

  // Projected field by field rather than passed through. The engine also
  // reports the resolved absolute path, which the front end has no use for
  // and should not be handed; naming the fields here keeps the wire shape
  // exactly what SuggestionApplyOutcome declares, today and after the engine
  // grows a field. The path is the request's, not the engine's root-relative one.
  if (result.status === 'applied') {
    return {
      status: 'applied',
      filePath,
      replacedLines: result.replacedLines,
    };
  }
  return {
    status: 'refused',
    filePath,
    reason: result.reason,
    detail: result.detail,
  };
}
