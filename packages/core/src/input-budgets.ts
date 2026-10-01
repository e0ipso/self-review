// packages/core/src/input-budgets.ts
// Safety budgets for the work the backend does on input it did not author:
// a reviewed directory, untracked files, git's diff output, the guide
// sidecar and a resumed review document.
//
// These are *safety* budgets, not *transport* thresholds. The `max-files` /
// `max-total-lines` config keys (payload-sizing.ts) decide how an already
// loaded review travels to the UI — whole, or file by file in large-payload
// mode — and the reviewer can tune them. The constants here bound how much
// the process will read, enumerate or allocate before it has decided
// anything at all, so they are checked *before* the expensive step (a
// `stat` size, an fd-bounded read, a counted directory walk), never after
// it. They are deliberately not configurable: each is far above any review a
// person can actually read, and exists only so a pathological input fails
// visibly instead of exhausting memory or hanging startup.
//
// Exceeding a budget is never silent and never presented as a complete
// review. Source and git budgets surface through `DiffLoadPayload.diagnostics`
// (the UI shows them instead of "no changes"); the guide budget produces the
// guide loader's single stderr warning; resume budgets throw a typed
// `ReviewXmlError` with code `input-too-large`.

const KIB = 1024;
const MIB = 1024 * KIB;

/**
 * Entries one source enumeration may examine: directory entries read during
 * a directory walk (files, subdirectories and skipped specials alike, in
 * every directory actually visited), or untracked files git lists for
 * synthetic diffs. Ignored directories are pruned before they are read, so
 * their contents never count. 50,000 is an order of magnitude past the
 * default `max-files` transport threshold (500) — a tree that size is a
 * build output or dependency cache, not something to review.
 */
export const MAX_SOURCE_ENTRIES = 50_000;

/**
 * Bytes sampled from the start of a file to decide whether it is binary
 * (a NUL byte in the sample). The same 8 KiB window the synthetic diff
 * generator always inspected; git's own heuristic looks at the first 8000
 * bytes. Only this prefix is read for a binary file, whatever its size.
 */
export const BINARY_SNIFF_BYTES = 8 * KIB;

/**
 * Largest single text file whose content is read into a synthetic diff
 * (directory reviews, single-file reviews, untracked files). A larger file
 * is still listed, without content, and named in a diagnostic. 5 MiB is
 * roughly 100,000 lines of source, already twice the default
 * `max-total-lines` threshold for the whole review.
 */
export const MAX_SOURCE_FILE_BYTES = 5 * MIB;

/**
 * Total bytes one synthetic-diff build may read across all of its files,
 * binary sniffs included. Once exhausted, every remaining file is listed
 * without content and the diagnostics say how many. 64 MiB keeps the built
 * diff text and its parsed form comfortably inside a renderer's memory, and
 * sits just above the git diff capture ceiling below.
 */
export const MAX_SOURCE_TOTAL_BYTES = 64 * MIB;

/**
 * Most bytes of `git diff` output captured from one invocation (the child
 * process `maxBuffer`). This was already the ceiling; exceeding it is now a
 * diagnostic naming the limit instead of a startup failure.
 */
export const MAX_GIT_DIFF_OUTPUT_BYTES = 50 * MIB;

/**
 * Largest guide sidecar the guide loader will read. A guide is a list of
 * paths with one-line descriptions plus an overview; 1 MiB covers tens of
 * thousands of entries. A larger file is ignored with the usual single
 * stderr warning, before it is read or parsed.
 */
export const MAX_GUIDE_BYTES = 1 * MIB;

/**
 * Largest review document `--resume-from` will read. A review document holds
 * comment text and attachment *references* (file names), never attachment
 * bytes, so 16 MiB is thousands of pages of review text — half the serve
 * transport's 32 MiB submission limit, which also carries the attachments.
 */
export const MAX_RESUME_XML_BYTES = 16 * MIB;

/**
 * Most attachment references one resumed document may carry, across all
 * comments and replies. Each is loaded on demand when the UI shows it, so
 * the count bounds how many reads a single document can ask for.
 */
export const MAX_RESUME_ATTACHMENTS = 1_000;

/**
 * Largest image read for a rendered preview or as a comment attachment. The
 * existing image preview limit, named here so attachment reads share it.
 */
export const MAX_IMAGE_BYTES = 10 * MIB;

/**
 * The source-loading budgets as one value, so a loader takes them as a
 * parameter rather than reading module constants deep inside. Overrides are
 * for tests and for embedders that want tighter limits; they are not, and
 * must not become, a user config setting.
 */
export interface SourceBudgets {
  /** See {@link MAX_SOURCE_ENTRIES}. */
  maxEntries: number;
  /** See {@link MAX_SOURCE_FILE_BYTES}. */
  maxFileBytes: number;
  /** See {@link MAX_SOURCE_TOTAL_BYTES}. */
  maxTotalBytes: number;
  /** See {@link MAX_GIT_DIFF_OUTPUT_BYTES}. */
  maxGitDiffOutputBytes: number;
}

export const DEFAULT_SOURCE_BUDGETS: Readonly<SourceBudgets> = Object.freeze({
  maxEntries: MAX_SOURCE_ENTRIES,
  maxFileBytes: MAX_SOURCE_FILE_BYTES,
  maxTotalBytes: MAX_SOURCE_TOTAL_BYTES,
  maxGitDiffOutputBytes: MAX_GIT_DIFF_OUTPUT_BYTES,
});

/** The default budgets with any overrides applied. */
export function resolveSourceBudgets(overrides: Partial<SourceBudgets> = {}): SourceBudgets {
  return { ...DEFAULT_SOURCE_BUDGETS, ...overrides };
}

/**
 * Render a byte count the way the diagnostics name budgets: `5 MiB`,
 * `7.3 MiB`, `812 KiB`, `100 bytes`.
 */
export function formatBytes(bytes: number): string {
  if (bytes >= MIB) return `${trimFixed(bytes / MIB)} MiB`;
  if (bytes >= KIB) return `${trimFixed(bytes / KIB)} KiB`;
  return `${bytes} bytes`;
}

function trimFixed(value: number): string {
  return value.toFixed(1).replace(/\.0$/, '');
}
