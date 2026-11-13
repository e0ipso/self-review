// Safety budgets, checked before the expensive step. Unlike the transport thresholds
// (`max-files`, `max-total-lines`), these are deliberately not configurable.
// Exceeding one surfaces as a diagnostic, a guide warning or `input-too-large`.

const KIB = 1024;
const MIB = 1024 * KIB;

/**
 * Entries one directory walk (or untracked-file listing) may examine; ignored directories are
 * pruned first.
 */
export const MAX_SOURCE_ENTRIES = 50_000;

/** Prefix sampled for a NUL byte to decide a file is binary. */
export const BINARY_SNIFF_BYTES = 8 * KIB;

/**
 * Largest text file read into a synthetic diff; a larger one is listed without content and named in
 * a diagnostic.
 */
export const MAX_SOURCE_FILE_BYTES = 5 * MIB;

/** Total bytes one synthetic-diff build may read, binary sniffs included. */
export const MAX_SOURCE_TOTAL_BYTES = 64 * MIB;

/** Most bytes of `git diff` output captured from one invocation (the child process `maxBuffer`). */
export const MAX_GIT_DIFF_OUTPUT_BYTES = 50 * MIB;

/** Largest guide sidecar the loader will read. */
export const MAX_GUIDE_BYTES = 1 * MIB;

/**
 * Largest review document `--resume-from` will read (text and attachment references, never bytes).
 */
export const MAX_RESUME_XML_BYTES = 16 * MIB;

/** Most attachment occurrences in a review document, including replies and repeated references. */
export const MAX_REVIEW_ATTACHMENTS = 1_000;

/** Backwards-compatible name for the same reader/writer document contract. */
export const MAX_RESUME_ATTACHMENTS = MAX_REVIEW_ATTACHMENTS;

/** Total newly staged asset bytes per publication. Existing references require no copy or read. */
export const MAX_PUBLICATION_ASSET_BYTES = 64 * MIB;

/** Largest image read for a rendered preview or a comment attachment. */
export const MAX_IMAGE_BYTES = 10 * MIB;

/**
 * The source-loading budgets as one value; overrides are for tests and embedders, never user
 * config.
 */
export interface SourceBudgets {
  maxEntries: number;
  maxFileBytes: number;
  maxTotalBytes: number;
  maxGitDiffOutputBytes: number;
  /** Representation limits are independent of bytes and transport/lazy thresholds. */
  maxFileLines?: number;
  maxTotalLines?: number;
  maxDiffFiles?: number;
  maxDiffHunks?: number;
  maxDiagnostics?: number;
}

/** Bounds retained objects even for empty lines, empty hunks and metadata-only files. */
export const MAX_SOURCE_FILE_LINES = 100_000;
export const MAX_SOURCE_TOTAL_LINES = 250_000;
export const MAX_DIFF_FILES = 10_000;
export const MAX_DIFF_HUNKS = 50_000;
export const MAX_DIFF_DIAGNOSTICS = 1_000;
/** Avoid repeating an enormous malicious header in each diagnostic. */
export const MAX_DIFF_DIAGNOSTIC_CHARS = 8 * KIB;

export type ResolvedSourceBudgets = Required<SourceBudgets>;

export const DEFAULT_SOURCE_BUDGETS: Readonly<ResolvedSourceBudgets> = Object.freeze({
  maxEntries: MAX_SOURCE_ENTRIES,
  maxFileBytes: MAX_SOURCE_FILE_BYTES,
  maxTotalBytes: MAX_SOURCE_TOTAL_BYTES,
  maxGitDiffOutputBytes: MAX_GIT_DIFF_OUTPUT_BYTES,
  maxFileLines: MAX_SOURCE_FILE_LINES,
  maxTotalLines: MAX_SOURCE_TOTAL_LINES,
  maxDiffFiles: MAX_DIFF_FILES,
  maxDiffHunks: MAX_DIFF_HUNKS,
  maxDiagnostics: MAX_DIFF_DIAGNOSTICS,
});

export function resolveSourceBudgets(
  overrides: Partial<SourceBudgets> = {}
): ResolvedSourceBudgets {
  const budgets = { ...DEFAULT_SOURCE_BUDGETS };
  for (const name of Object.keys(budgets) as (keyof SourceBudgets)[]) {
    const value = overrides[name];
    if (value !== undefined) budgets[name] = value;
  }
  for (const [name, value] of Object.entries(budgets)) {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new RangeError(`${name} must be a nonnegative safe integer`);
    }
  }
  return budgets;
}

/** `5 MiB`, `7.3 MiB`, `812 KiB`, `100 bytes`. */
export function formatBytes(bytes: number): string {
  if (bytes >= MIB) return `${trimFixed(bytes / MIB)} MiB`;
  if (bytes >= KIB) return `${trimFixed(bytes / KIB)} KiB`;
  return `${bytes} bytes`;
}

function trimFixed(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}

/** Internal refusal shared by patch parsing and direct projection. */
export class RepresentationLimitError extends Error {
  constructor(
    readonly aggregate: boolean,
    detail: string
  ) {
    super(`Not loaded: ${detail} representation budget exceeded.`);
    this.name = 'RepresentationLimitError';
  }
}

/** Charge before allocating. Discarded objects still count toward this operation's work. */
export function createRepresentationBudget(budgets: ResolvedSourceBudgets) {
  let files = 0;
  let hunks = 0;
  let lines = 0;
  let fileLines = 0;
  return {
    beginFile() {
      if (files >= budgets.maxDiffFiles)
        throw new RepresentationLimitError(true, `${budgets.maxDiffFiles}-file`);
      files++;
      fileLines = 0;
    },
    addHunk() {
      if (hunks >= budgets.maxDiffHunks)
        throw new RepresentationLimitError(true, `${budgets.maxDiffHunks}-hunk total`);
      hunks++;
    },
    addLines(count: number) {
      if (count > budgets.maxFileLines - fileLines)
        throw new RepresentationLimitError(false, `${budgets.maxFileLines}-line per-file`);
      if (count > budgets.maxTotalLines - lines)
        throw new RepresentationLimitError(true, `${budgets.maxTotalLines}-line total`);
      fileLines += count;
      lines += count;
    },
  };
}
