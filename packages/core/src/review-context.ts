// Re-diff preparation/execution and guarded merging into the same committed review.
import type { DiffFile, DiffHunk, ExpandContextRequest, ReviewSourceIdentity } from './types';
import type { ReviewSession } from './review-session';
import { singleFileRediffArgs } from './git-diff-args';
import { runGitDiffAsync } from './git';
import { parseDiff } from './diff-parser';
import { MAX_GIT_DIFF_OUTPUT_BYTES } from './input-budgets';
import { readReviewedContent } from './snapshot-reader';
import type { ReviewedSnapshot } from './snapshot-reader';
import { rootRelativeReviewedPath } from './source-identity';

/** The effects expansion needs; callers and tests can supply runners/readers without module mocks. */
export interface ContextExpansionDependencies {
  runDiff(args: string[], cwd: string): Promise<string>;
  readContent: typeof readReviewedContent;
  report(message: string, error?: unknown): void;
}

const nodeExpansionDependencies: ContextExpansionDependencies = {
  runDiff: runGitDiffAsync,
  readContent: readReviewedContent,
  report(message, error) {
    if (error === undefined) console.error(message);
    else console.error(message, error);
  },
};

/** Zero when unreadable; the caller treats that as unknown. */
async function countReviewedLines(
  session: ReviewedSnapshot,
  file: DiffFile,
  dependencies: ContextExpansionDependencies
): Promise<number> {
  const side = file.newPath ? 'new' : 'old';
  const filePath = side === 'new' ? file.newPath : file.oldPath;
  const result = await dependencies.readContent(session, filePath, side, {
    maxBytes: MAX_GIT_DIFF_OUTPUT_BYTES,
  });
  if (!result.ok) {
    dependencies.report(`[review] Line count unavailable for ${filePath}: ${result.message}`);
    return 0;
  }
  return countLines(result.content);
}

function countLines(content: Buffer): number {
  let newlines = 0;
  for (const byte of content) {
    if (byte === 0x0a) newlines++;
  }
  return content.length > 0 && content[content.length - 1] === 0x0a ? newlines : newlines + 1;
}

/**
 * Re-run the review's own git diff over one file with more context, via
 * {@link singleFileRediffArgs}. Git runs at the source root; a `--relative` review is
 * restated with the prefix resolved at load time, and the file's paths (both, for a
 * rename or copy, so git pairs them) are root-relative literal pathspecs. The entry
 * returned is the one matching the file's old and new paths, not git's first.
 *
 * Expanded hunks are written back to the session's diff data. Returns null when
 * there is no git diff or tracked file, git's output lacks the file, or git fails.
 */
export async function expandContext(
  session: Pick<ReviewSession, 'diffData' | 'sourceIdentity' | 'reviewedPaths'>,
  request: ExpandContextRequest,
  dependencies: ContextExpansionDependencies = nodeExpansionDependencies
): Promise<{ hunks: DiffHunk[]; totalLines: number } | null> {
  const diffData = session.diffData;
  const identity = session.sourceIdentity;
  if (!diffData || diffData.source.type !== 'git' || identity === null) {
    return null;
  }
  if (identity.mode !== 'git' && identity.mode !== 'remote') {
    return null;
  }
  if (!Number.isSafeInteger(request.contextLines) || request.contextLines < 0) {
    return null;
  }
  // Untracked files are synthetic additions git never compared.
  const target = diffData.files.find(
    f => !f.isUntracked && (f.newPath || f.oldPath) === request.filePath
  );
  if (!target) {
    return null;
  }

  // commitDiffData installs a fresh authorization set even when the payload/identity are reused.
  const reviewedPaths = session.reviewedPaths;
  const snapshot: ReviewedSnapshot = { sourceIdentity: identity, reviewedPaths };
  const isCurrent = () =>
    session.reviewedPaths === reviewedPaths && session.sourceIdentity === identity;
  try {
    const args = contextDiffArgs(identity, target, request.contextLines);
    const rawDiff = await dependencies.runDiff(args, identity.sourceRoot);
    if (!isCurrent()) return null;
    const expandedFile = parseDiff(rawDiff).find(
      f => f.oldPath === target.oldPath && f.newPath === target.newPath
    );
    if (!expandedFile) {
      dependencies.report(
        `[review] Expanded diff for ${request.filePath} did not contain the file`
      );
      return null;
    }

    // The reviewed side's length, for gap detection; zero keeps the bars visible.
    const totalLines = await countReviewedLines(snapshot, target, dependencies);
    if (!isCurrent() || !session.diffData) return null;

    session.diffData = {
      ...session.diffData,
      files: session.diffData.files.map(f =>
        f.oldPath === target.oldPath && f.newPath === target.newPath
          ? { ...f, hunks: expandedFile.hunks }
          : f
      ),
    };

    return { hunks: expandedFile.hunks, totalLines };
  } catch (error) {
    dependencies.report(`[review] Failed to expand context for ${request.filePath}:`, error);
    return null;
  }
}

/** Restate one file's comparison at the captured source root, with literal root-relative paths. */
function contextDiffArgs(
  identity: ReviewSourceIdentity,
  target: DiffFile,
  contextLines: number
): string[] {
  const rediff = singleFileRediffArgs(identity.gitDiffArgv);
  const prefix = identity.pathPrefix;
  const paths = [...new Set([target.oldPath, target.newPath].filter(p => p !== ''))];
  return [
    ...rediff.args,
    ...(prefix === '' ? [] : [`--relative=${prefix}`]),
    `-U${contextLines}`,
    '--',
    ...paths.map(p => `:(top,literal)${rootRelativeReviewedPath(identity, p)}`),
  ];
}
