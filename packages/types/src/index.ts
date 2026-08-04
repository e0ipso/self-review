// @self-review/types — Shared TypeScript type definitions.
// Zero runtime dependencies. Used by @self-review/core, @self-review/react,
// and the Electron app's src/shared/types.ts.

// ===== Git Diff Types =====

export type ChangeType = 'added' | 'modified' | 'deleted' | 'renamed';

export type DiffLineType = 'context' | 'addition' | 'deletion';

export interface DiffLine {
  type: DiffLineType;
  oldLineNumber: number | null;
  newLineNumber: number | null;
  content: string;
}

export interface DiffHunk {
  header: string;
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: DiffLine[];
}

export interface DiffFile {
  oldPath: string;
  newPath: string;
  changeType: ChangeType;
  isBinary: boolean;
  hunks: DiffHunk[];
  isUntracked?: boolean;
  contentLoaded?: boolean;
}

// ===== Diff Source Types =====

export type DiffSource =
  | { type: 'git'; gitDiffArgs: string; repository: string }
  | { type: 'directory'; sourcePath: string }
  | { type: 'file'; sourcePath: string }
  | { type: 'welcome' }
  | { type: 'loading' };

// ===== Review State Types =====

export interface Suggestion {
  originalCode: string;
  proposedCode: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mediaType: string;
  data?: ArrayBuffer; // Present in-memory during session, stripped before XML serialization
}

export interface LineRange {
  side: 'old' | 'new';
  start: number;
  end: number;
}

/**
 * How consequential a finding is if it is real, most to least.
 * See SeverityEnum in self-review-v3.xsd for the semantics of each value.
 */
export type CommentSeverity = 'critical' | 'major' | 'minor' | 'info';

/**
 * How sure the author is that a finding is real, most to least.
 * See ConfidenceEnum in self-review-v3.xsd for the semantics of each value.
 */
export type CommentConfidence = 'high' | 'medium' | 'low';

/**
 * The forge hosting a remote pull/merge request.
 * See RemoteForgeEnum in self-review-v3.xsd.
 */
export type RemoteForge = 'github' | 'gitlab';

/**
 * One turn in the conversation about a comment.
 *
 * A reply is deliberately thin. It carries no category, no severity, no
 * confidence and no suggestion: all four are properties of the finding, and
 * the finding is the root comment. A counter-proposal goes in `body` as a
 * fenced code block.
 *
 * Ordering is positional. The array order is the document order is the
 * conversation order, in all three directions. Nothing sorts replies.
 */
export interface Reply {
  /**
   * In-memory render key only. Like `ReviewComment.id`, this is regenerated
   * on every parse and is never written to XML — the tree supplies parent
   * linkage and document order supplies ordering, so nothing needs naming.
   */
  id: string;
  body: string;
  /** Absent means the human reviewer, present means a bot or LLM. */
  author?: string;
  attachments?: Attachment[];
  /**
   * Identifier of the remote comment this reply was fetched from, in the
   * forge's own id space (see `ReviewState.remoteForge`). Undefined for
   * replies authored locally. Never an ordering signal: array order stays
   * conversation order.
   */
  remoteId?: string;
}

export interface ReviewComment {
  id: string;
  filePath: string;
  lineRange: LineRange | null; // null = file-level comment
  body: string;
  category: string;
  suggestion: Suggestion | null;
  author?: string;
  // Thresholding signals. Undefined means the author took no position, and a
  // consumer must treat that as below any floor it applies.
  severity?: CommentSeverity;
  confidence?: CommentConfidence;
  orphaned?: boolean; // for --resume-from conflict handling
  attachments?: Attachment[];
  /** Ordered conversation turns on this comment. Undefined when there are none. */
  replies?: Reply[];
  /**
   * Identifier of the remote discussion thread or comment this comment was
   * fetched from, in the forge's own id space (see `ReviewState.remoteForge`).
   * Undefined for comments authored locally.
   */
  remoteId?: string;
}

export interface FileReviewState {
  path: string;
  changeType: ChangeType;
  viewed: boolean;
  comments: ReviewComment[];
}

export interface ReviewState {
  timestamp: string;
  source: DiffSource;
  files: FileReviewState[];
  // Remote provenance. Set only for a review taken against a remote PR/MR;
  // a purely local review carries none of these, and absent behaves like
  // absent severity/confidence: the serializer omits the attribute and the
  // parser leaves the field undefined.
  /** URL of the remote pull/merge request under review. */
  remoteUrl?: string;
  /** Commit SHA the remote diff was computed from, for drift detection. */
  remoteBaseSha?: string;
  /** Commit SHA of the remote PR/MR head at fetch time, for drift detection. */
  remoteHeadSha?: string;
  /** Which forge hosts the remote PR/MR. Names the id space of remoteId values. */
  remoteForge?: RemoteForge;
}

// ===== Walkthrough Guide Types =====
// The guide is a read-only sidecar (self-review-guide-v1.xsd) generated
// before the review starts. It labels and orders files for orientation; it
// can never hide them. See docs/intent/llm-review-guide.md.

/**
 * One file inside a guide group. The path must match a diff file
 * (repository-relative, same convention as review.xml); entries whose path
 * matches nothing in the diff are silently dropped by the consumer.
 */
export interface GuideFileEntry {
  /** File path relative to the repository root. For renames, the new path. */
  path: string;
  /** One-line description of the role this file plays in the change. */
  description: string;
}

/**
 * A named set of related files in the walkthrough. Groups are labels for
 * orientation, never suppressions: every group and every file in it is
 * shown. Array position is reading order.
 */
export interface GuideGroup {
  /** Short display name shown as the group heading, e.g. "Core change". */
  name: string;
  /** One line explaining why these files form a group and what to look for. */
  rationale: string;
  /** The files in this group, in reading order. At least one entry. */
  files: GuideFileEntry[];
}

/**
 * A parsed walkthrough guide. Files in the diff that no group mentions are
 * presented by the consumer in an implicit trailing "Everything else"
 * group; that group is derived at render time and never part of this state.
 */
export interface ReviewGuide {
  /**
   * Review-level orientation prose shown before the first file. Markdown;
   * may include a fenced code block labelled "mermaid" for a diagram.
   * Absent when the guide has no overview.
   */
  overview?: string;
  /** Ordered reading groups. Array position is reading order. */
  groups: GuideGroup[];
}

/**
 * One file inside a resolved display group. Unlike {@link GuideFileEntry},
 * the description is optional: files swept into the implicit
 * "Everything else" group have no guide-authored one-liner.
 */
export interface ResolvedGuideFile {
  /** File path relative to the repository root. For renames, the new path. */
  path: string;
  /** One-line description from the guide; absent for implicit-group files. */
  description?: string;
}

/**
 * A display group produced by reconciling a {@link ReviewGuide} with the
 * actual diff file list. Guide entries missing from the diff are dropped,
 * duplicate references keep only their first group, and diff files the
 * guide never mentions land in a terminal implicit group (in diff order)
 * marked with `implicit: true` so the UI can label it.
 */
export interface ResolvedGuideGroup {
  /** Display name for the group heading. */
  name: string;
  /** One-line rationale from the guide; absent for the implicit group. */
  rationale?: string;
  /** True only for the derived trailing "Everything else" group. */
  implicit: boolean;
  /** The files shown under this group, in display order. Never empty. */
  files: ResolvedGuideFile[];
}

// ===== Configuration Types =====

export interface CategoryDef {
  name: string;
  description: string;
  color: string;
}

export interface AppConfig {
  theme: 'light' | 'dark' | 'system';
  diffView: 'split' | 'unified';
  fontSize: number;
  outputFormat: string;
  outputFile: string;
  ignore: string[];
  categories: CategoryDef[];
  defaultDiffArgs: string;
  showUntracked: boolean;
  showUntrackedExplicit: boolean;
  wordWrap: boolean;
  maxFiles: number;
  maxTotalLines: number;
  /**
   * Path to the walkthrough guide sidecar (`guide-file` YAML key). When
   * unset, the guide path is derived from the resolved output path as
   * `<output-basename>.guide.xml`.
   */
  guideFile?: string;
}

// ===== IPC Payload Types =====

export interface DiffLoadPayload {
  files: DiffFile[];
  source: DiffSource;
  isLargePayload?: boolean;
}

export interface ResumeLoadPayload {
  comments: ReviewComment[];
  /** Paths the prior review marked as done. Absent when nothing was marked. */
  viewedFiles?: string[];
}

/**
 * Payload for the `guide:load` channel (Main → Renderer). Sent only when a
 * valid walkthrough guide sidecar was discovered; carries display-ready
 * data — the overview plus groups already reconciled against the parsed
 * diff — so the renderer stays free of tolerance logic. Metadata only
 * (paths, names, descriptions): safe to send in large-payload mode.
 */
export interface GuideLoadPayload {
  /** Review-level orientation prose (Markdown, optionally Mermaid). */
  overview?: string;
  /** Resolved display groups, in reading order. */
  groups: ResolvedGuideGroup[];
}

// ===== Output Path Types =====

export interface OutputPathInfo {
  resolvedOutputPath: string;
  outputPathWritable: boolean;
}

// ===== Expand Context Types =====

export interface ExpandContextRequest {
  filePath: string;
  contextLines: number;
}

export interface ExpandContextResponse {
  hunks: DiffHunk[];
  totalLines: number;
}

// ===== Find in Page Types =====

export interface FindInPageRequest {
  text: string;
  forward: boolean;
  findNext: boolean;
}

export interface FindInPageResult {
  activeMatchOrdinal: number;
  matches: number;
  finalUpdate: boolean;
}

// ===== Version Update Types =====

export interface VersionUpdateInfo {
  latestVersion: string;
  releaseUrl: string;
}

// ===== Image Preview Types =====

export type ImageLoadResult = { dataUri: string } | { error: string };

// ===== Payload Guard Types =====

export interface PayloadStats {
  fileCount: number;
  totalLines: number;
  exceedsFiles: boolean;
  exceedsLines: boolean;
  exceedsAny: boolean;
}
