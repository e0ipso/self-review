// Parse an XML review file back into ReviewComment[]. Text is lossless (no coercion, one
// decoding pass, see xml-text.ts). An unreadable document throws ReviewXmlError; a comment
// with an unusable anchor or suggestion is kept as file-level feedback and reported in
// `importDiagnostics`.

import { XMLParser, XMLValidator } from 'fast-xml-parser';
import { readFileWithinBudgetSync } from './bounded-read';
import { formatBytes, MAX_RESUME_ATTACHMENTS, MAX_RESUME_XML_BYTES } from './input-budgets';
import {
  ReviewComment,
  Suggestion,
  LineRange,
  DiffSource,
  CommentSeverity,
  CommentConfidence,
  RemoteForge,
  Attachment,
  Reply,
} from './types';
import { validateLineAnchor } from './anchor-validation';
import { ReviewXmlError } from './xml-errors';
import { decodeXmlEntities } from './xml-text';

const SEVERITY_VALUES: readonly CommentSeverity[] = ['critical', 'major', 'minor', 'info'];
const CONFIDENCE_VALUES: readonly CommentConfidence[] = ['high', 'medium', 'low'];
const REMOTE_FORGE_VALUES: readonly RemoteForge[] = ['github', 'gitlab'];

export interface ParsedReview {
  comments: ReviewComment[];
  /** Paths of files the previous review marked as done (`viewed="true"`). */
  viewedFiles: string[];
  gitDiffArgs: string;
  source: DiffSource;
  /**
   * One line per comment downgraded to file-level feedback, with its suggestion text folded into
   * the body.
   */
  importDiagnostics: string[];
  // Remote provenance, read tolerantly off the review root. Undefined when
  // the document carries no remote attributes, i.e. every pre-remote and
  // purely local review.
  remoteUrl?: string;
  remoteBaseSha?: string;
  remoteHeadSha?: string;
  remoteForge?: RemoteForge;
}

/**
 * Sized before it is read, so an oversized document or a FIFO is refused unread.
 *
 * @throws ReviewXmlError `read-failed`, `input-too-large`, or what
 *   {@link parseReviewXmlString} throws.
 */
export function parseReviewXml(xmlPath: string): ParsedReview {
  let read: ReturnType<typeof readFileWithinBudgetSync>;
  try {
    read = readFileWithinBudgetSync(xmlPath, MAX_RESUME_XML_BYTES);
  } catch (error) {
    throw new ReviewXmlError('read-failed', `Could not read ${xmlPath}: ${messageOf(error)}`, {
      cause: error,
    });
  }
  if (read.kind === 'not-regular') {
    throw new ReviewXmlError('read-failed', `Could not read ${xmlPath}: not a regular file`);
  }
  if (read.kind === 'too-large') {
    throw new ReviewXmlError(
      'input-too-large',
      `Could not read ${xmlPath}: it is ${formatBytes(read.size)}, over the ` +
        `${formatBytes(MAX_RESUME_XML_BYTES)} limit for a review document`
    );
  }
  return parseReviewXmlString(read.content.toString('utf-8'));
}

/**
 * Namespace-blind by design: v1, v2 and v3 documents read identically.
 *
 * @throws ReviewXmlError `parse-failed`, `missing-root`, or `input-too-large`
 *   (over `MAX_RESUME_ATTACHMENTS`).
 */
export function parseReviewXmlString(xmlContent: string): ParsedReview {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    trimValues: false,
    // Lossless: `00123`, `1e3` and `false` stay text, and decodeXmlEntities is the only decoding.
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
  });

  // The parser is lenient (garbage still yields an object), so check well-formedness first for a
  // located message.
  const wellFormed = XMLValidator.validate(xmlContent);
  if (wellFormed !== true) {
    const { msg, line, col } = wellFormed.err;
    const where = col !== undefined ? `line ${line}, column ${col}` : `line ${line}`;
    throw new ReviewXmlError('parse-failed', `Invalid XML: ${msg} (${where})`);
  }

  let result: Record<string, unknown>;
  try {
    result = parser.parse(xmlContent) as Record<string, unknown>;
  } catch (error) {
    throw new ReviewXmlError('parse-failed', `Invalid XML: ${messageOf(error)}`, { cause: error });
  }

  const review = result.review as Record<string, unknown> | undefined;
  if (!review || typeof review !== 'object') {
    throw new ReviewXmlError('missing-root', 'Invalid XML: missing <review> root element');
  }

  const gitDiffArgs = attribute(review, '@_git-diff-args') ?? '';
  const source = parseSource(review);
  const comments: ReviewComment[] = [];
  const viewedFiles: string[] = [];
  const importDiagnostics: string[] = [];

  for (const file of toChildArray(review.file)) {
    // Only a missing attribute skips: the empty string is the review-level sentinel path and must
    // round-trip.
    const filePath = attribute(file, '@_path');
    if (filePath === undefined) continue;

    if (parseViewed(file['@_viewed'])) {
      viewedFiles.push(filePath);
    }

    toChildArray(file.comment).forEach((comment, index) => {
      comments.push(parseComment(comment, filePath, index + 1, importDiagnostics));
    });
  }

  // Bounds the reads one document can ask for; refuse rather than drop attachments.
  const attachmentCount = countAttachments(comments);
  if (attachmentCount > MAX_RESUME_ATTACHMENTS) {
    throw new ReviewXmlError(
      'input-too-large',
      `The review document carries ${attachmentCount} attachments, over the limit of ` +
        `${MAX_RESUME_ATTACHMENTS} for a review document`
    );
  }

  return {
    comments,
    viewedFiles,
    gitDiffArgs,
    source,
    importDiagnostics,
    remoteUrl: attribute(review, '@_remote-url'),
    remoteBaseSha: attribute(review, '@_remote-base-sha'),
    remoteHeadSha: attribute(review, '@_remote-head-sha'),
    remoteForge: parseEnumAttribute(review['@_remote-forge'], REMOTE_FORGE_VALUES),
  };
}

/**
 * A comment whose anchor or suggestion cannot be honoured is downgraded to file-level
 * feedback, not dropped: its suggestion text is folded into the body so it is readable but
 * never an Apply target. The diagnostic names it by ordinal (and remote-id) within the file.
 */
function parseComment(
  comment: Record<string, unknown>,
  filePath: string,
  ordinal: number,
  diagnostics: string[]
): ReviewComment {
  const anchor = validateLineAnchor({
    oldLineStart: attribute(comment, '@_old-line-start'),
    oldLineEnd: attribute(comment, '@_old-line-end'),
    newLineStart: attribute(comment, '@_new-line-start'),
    newLineEnd: attribute(comment, '@_new-line-end'),
  });
  const lineRange: LineRange | null = anchor?.ok ? anchor.anchor : null;
  const suggestion = parseSuggestion(comment, lineRange);

  let body = text(comment, 'body') ?? '';
  let reason: string | null = null;
  if (anchor && !anchor.ok) {
    reason = anchor.reason;
  } else if (suggestion && !suggestion.ok) {
    reason = suggestion.reason;
  }
  if (reason !== null) {
    if (suggestion) body = foldSuggestionIntoBody(body, suggestion.text, reason);
    const remoteId = attribute(comment, '@_remote-id');
    const label =
      remoteId !== undefined ? `comment ${ordinal} (remote-id ${remoteId})` : `comment ${ordinal}`;
    diagnostics.push(`${filePath}: ${label} anchor ${reason}; kept as file-level feedback`);
  }

  const reviewComment: ReviewComment = {
    id: generateId(),
    filePath,
    lineRange,
    body,
    category: text(comment, 'category') ?? '',
    suggestion: suggestion?.ok ? suggestion.suggestion : null,
    author: optionalAuthor(comment),
    severity: parseEnumAttribute(comment['@_severity'], SEVERITY_VALUES),
    confidence: parseEnumAttribute(comment['@_confidence'], CONFIDENCE_VALUES),
    remoteId: attribute(comment, '@_remote-id'),
  };

  const attachments = parseAttachments(comment, reviewComment.id);
  if (attachments) reviewComment.attachments = attachments;

  const replies = parseReplies(comment);
  if (replies) reviewComment.replies = replies;

  return reviewComment;
}

type SuggestionRead =
  | { ok: true; suggestion: Suggestion; text: SuggestionText }
  | { ok: false; reason: string; text: SuggestionText };

interface SuggestionText {
  original?: string;
  proposed?: string;
}

/**
 * Usable only with both code elements as plain text and a valid anchor (Apply replaces the anchored
 * lines). Other shapes report whatever text they carried.
 */
function parseSuggestion(
  comment: Record<string, unknown>,
  lineRange: LineRange | null
): SuggestionRead | null {
  const raw = comment.suggestion;
  if (raw === undefined || raw === null) return null;

  const node = typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const original = text(node, 'original-code');
  const proposed = text(node, 'proposed-code');
  const text_: SuggestionText = { original, proposed };

  if ('original-code' in node && original === undefined) {
    return { ok: false, reason: 'suggestion original-code is not plain text', text: text_ };
  }
  if ('proposed-code' in node && proposed === undefined) {
    return { ok: false, reason: 'suggestion proposed-code is not plain text', text: text_ };
  }
  if (original === undefined || proposed === undefined) {
    return {
      ok: false,
      reason: 'suggestion is missing original-code or proposed-code',
      text: text_,
    };
  }
  if (lineRange === null) {
    return { ok: false, reason: 'suggestion has no line anchor', text: text_ };
  }
  return { ok: true, suggestion: { originalCode: original, proposedCode: proposed }, text: text_ };
}

/**
 * The fence is one backtick longer than the longest run in the code, so nested fences render
 * intact.
 */
function foldSuggestionIntoBody(body: string, code: SuggestionText, reason: string): string {
  const parts = [body, '', `_Imported suggestion could not be anchored (${reason})._`];
  if (code.original !== undefined) parts.push('Original:', ...fenced(code.original));
  if (code.proposed !== undefined) parts.push('Proposed:', ...fenced(code.proposed));
  return parts.join('\n');
}

function fenced(code: string): string[] {
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map(run => run.length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  return [fence, code, fence];
}

/**
 * Read an enumerated attribute, dropping values the schema does not define.
 *
 * An unrecognised value becomes undefined rather than being passed through:
 * undefined is the fail-safe reading (below every threshold floor), and it
 * keeps a resumed review serializable, since the serializer validates its
 * output against the XSD before writing.
 */
function parseEnumAttribute<T extends string>(raw: unknown, allowed: readonly T[]): T | undefined {
  if (raw === undefined || raw === null) return undefined;
  const value = decodeXmlEntities(String(raw));
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/** Decoded text, or undefined when absent; the empty string is a value. */
function attribute(node: Record<string, unknown>, key: string): string | undefined {
  const raw = node[key];
  if (raw === undefined || raw === null) return undefined;
  // A boolean attribute (`<file viewed>`) parses as `true`.
  return decodeXmlEntities(typeof raw === 'string' ? raw : String(raw));
}

/** Decoded child text, or undefined when absent or not plain text. */
function text(node: Record<string, unknown>, key: string): string | undefined {
  const raw = node[key];
  if (typeof raw === 'string') return decodeXmlEntities(raw);
  return undefined;
}

/** Absent means human, so an empty author reads as absent. */
function optionalAuthor(node: Record<string, unknown>): string | undefined {
  const author = attribute(node, '@_author');
  return author === undefined || author === '' ? undefined : author;
}

/**
 * Read the `viewed` attribute of a <file> element.
 *
 * Anything other than an explicit true reads as not viewed: the attribute is
 * optional, and treating an unknown value as "already reviewed" would silently
 * hide files from the resumed review.
 */
function parseViewed(raw: unknown): boolean {
  return raw === true || String(raw) === 'true';
}

function parseSource(review: Record<string, unknown>): DiffSource {
  const sourcePath = attribute(review, '@_source-path');
  if (sourcePath) {
    return { type: 'directory', sourcePath };
  }

  const gitDiffArgs = attribute(review, '@_git-diff-args');
  const repository = attribute(review, '@_repository');
  if (gitDiffArgs !== undefined || repository !== undefined) {
    return {
      type: 'git',
      gitDiffArgs: gitDiffArgs ?? '',
      repository: repository ?? '',
    };
  }

  return { type: 'welcome' };
}

/**
 * Normalize a repeatable child element into an array.
 *
 * fast-xml-parser collapses a single occurrence into a bare object and only
 * produces an array from two or more, so every repeatable child in this file
 * has to be widened before it can be iterated. An absent child yields an empty
 * array.
 */
function toChildArray(raw: unknown): Record<string, unknown>[] {
  if (Array.isArray(raw)) return raw as Record<string, unknown>[];
  if (raw === undefined || raw === null) return [];
  return [raw as Record<string, unknown>];
}

/**
 * Read `<attachment>` children of a comment or a reply.
 *
 * Attachment ids are synthetic: nothing in the document names them, so they are
 * derived from the id of their owner, which is why the prefix is a parameter
 * rather than read off the node. Returns undefined rather than [] when there
 * are none, matching the optional field on the type.
 */
function parseAttachments(
  node: Record<string, unknown>,
  idPrefix: string
): Attachment[] | undefined {
  const raw = toChildArray(node.attachment);
  if (raw.length === 0) return undefined;

  return raw.map((att, i) => ({
    id: `${idPrefix}-att-${i}`,
    fileName: attribute(att, '@_path') ?? '',
    mediaType: attribute(att, '@_media-type') ?? 'image/png',
  }));
}

/**
 * Read `<reply>` children in document order.
 *
 * Document order is conversation order: a reply carries no timestamp and no
 * identifier, so the order of this array is the only ordering signal a thread
 * ever has. Returns undefined rather than [] when there are none, so a
 * reply-free comment keeps exactly the shape it had before threads existed.
 */
function parseReplies(comment: Record<string, unknown>): Reply[] | undefined {
  const raw = toChildArray(comment.reply);
  if (raw.length === 0) return undefined;

  return raw.map(node => {
    const id = generateId();
    const reply: Reply = {
      id,
      body: text(node, 'body') ?? '',
      author: optionalAuthor(node),
      remoteId: attribute(node, '@_remote-id'),
    };

    const attachments = parseAttachments(node, id);
    if (attachments) reply.attachments = attachments;

    return reply;
  });
}

/** Attachment references across every comment and reply. */
function countAttachments(comments: ReviewComment[]): number {
  let count = 0;
  for (const comment of comments) {
    count += comment.attachments?.length ?? 0;
    for (const reply of comment.replies ?? []) {
      count += reply.attachments?.length ?? 0;
    }
  }
  return count;
}

function messageOf(error: unknown): string {
  if (error instanceof Error) return error.message;
  return typeof error === 'string' ? error : JSON.stringify(error);
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
