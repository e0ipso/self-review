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

/** Most attachment references one resumed document may carry; bounds the reads it can ask for. */
export const MAX_RESUME_ATTACHMENTS = 1_000;

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
}

export const DEFAULT_SOURCE_BUDGETS: Readonly<SourceBudgets> = Object.freeze({
  maxEntries: MAX_SOURCE_ENTRIES,
  maxFileBytes: MAX_SOURCE_FILE_BYTES,
  maxTotalBytes: MAX_SOURCE_TOTAL_BYTES,
  maxGitDiffOutputBytes: MAX_GIT_DIFF_OUTPUT_BYTES,
});

export function resolveSourceBudgets(overrides: Partial<SourceBudgets> = {}): SourceBudgets {
  return { ...DEFAULT_SOURCE_BUDGETS, ...overrides };
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
