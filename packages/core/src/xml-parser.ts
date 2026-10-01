// packages/core/src/xml-parser.ts
// Parse an XML review file back into ReviewComment[].
//
// Two contracts hold here. Text is lossless: no value coercion, no falsy
// fallbacks, and exactly one decoding pass over the raw entities (see
// xml-text.ts), so what the serializer wrote is what comes back. And nothing
// here ends the process: a document that cannot be read throws a
// ReviewXmlError for the host to report, while a document that can be read
// but carries a comment this app could not honour — an anchor that is not a
// usable range, a suggestion it could not apply — keeps that comment as
// file-level feedback and says so in `importDiagnostics`.

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
   * One line per comment the importer could not take as written: an anchor
   * that is not a usable line range, or a suggestion in a shape this app
   * cannot apply. Each such comment is kept as file-level feedback with its
   * suggestion text folded into the body, so nothing the author wrote is
   * lost; the diagnostic says which comment and why. Empty for a clean
   * import. Hosts print these to stderr and the UI shows them.
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
 * Read and parse a review document from disk.
 *
 * The file is sized before it is read: a document over
 * `MAX_RESUME_XML_BYTES` is refused without being read or parsed, and a FIFO
 * or device is refused without blocking on it.
 *
 * @throws ReviewXmlError `read-failed` when the file cannot be read or is
 *   not a regular file, `input-too-large` when it exceeds the resume budget,
 *   or whatever {@link parseReviewXmlString} throws for its content.
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
 * Parse a review document.
 *
 * Namespace-blind by design: v1, v2 and v3 documents read identically.
 *
 * @throws ReviewXmlError `parse-failed` when the content is not XML the
 *   parser can load, `missing-root` when there is no `<review>` element,
 *   `input-too-large` when it carries more than `MAX_RESUME_ATTACHMENTS`
 *   attachment references.
 */
export function parseReviewXmlString(xmlContent: string): ParsedReview {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    trimValues: false,
    // Lossless by construction. Values stay the strings the document holds,
    // so `00123`, `007`, `1e3`, `0` and `false` are text, not numbers or
    // booleans; and the library does no entity work at all, so the single
    // bounded pass in decodeXmlEntities is the only decoding there is.
    parseTagValue: false,
    parseAttributeValue: false,
    processEntities: false,
  });

  // The parser itself is lenient — an unclosed element or plain garbage
  // still yields an object — so well-formedness is checked first, and the
  // check's located message is what the host gets to print.
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
    // Skip only when the attribute is genuinely absent: the empty string
    // is the review-level sentinel path (REVIEW_LEVEL_FILE_PATH) used by
    // fetch-comments for threads with no file anchor, and must round-trip.
    const filePath = attribute(file, '@_path');
    if (filePath === undefined) continue;

    if (parseViewed(file['@_viewed'])) {
      viewedFiles.push(filePath);
    }

    toChildArray(file.comment).forEach((comment, index) => {
      comments.push(parseComment(comment, filePath, index + 1, importDiagnostics));
    });
  }

  // Each attachment is fetched on demand once the review is on screen, so
  // the count bounds how many reads one document can ask for. Refuse the
  // document rather than drop attachments the author wrote.
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
 * Read one `<comment>`, validating its anchor and suggestion shape.
 *
 * A comment whose anchor or suggestion cannot be honoured is not dropped and
 * not passed through as-is either: it is downgraded to file-level feedback.
 * Everything the author wrote survives — body, category, author, severity,
 * confidence, replies, attachments — and the suggestion text, if any, is
 * folded into the body as fenced code so it stays readable without ever
 * becoming an Apply target. The diagnostic names the comment by its ordinal
 * within the file (and its remote-id when it has one) so the reviewer can
 * find it.
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

/** Whatever code text a `<suggestion>` carried, usable or not. */
interface SuggestionText {
  original?: string;
  proposed?: string;
}

/**
 * Read a `<suggestion>`, or `null` when there is none.
 *
 * A usable suggestion has both code elements as plain text and sits on a
 * comment with a usable anchor: Apply replaces exactly the anchored lines
 * with the proposal, so a suggestion with no anchor, or on an anchor that
 * failed validation, has nowhere to go. Every other shape is reported with
 * whatever text it did carry, so the caller can keep that text visible.
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
 * Append a downgraded suggestion's code to the comment body as fenced
 * blocks, so the proposal stays readable in the UI and in the saved document
 * without being an actionable Suggestion. The fence is one backtick longer
 * than the longest run the code itself contains, so code that holds fences
 * renders intact.
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

/**
 * Read an attribute as decoded text, or undefined when absent. Values are
 * taken as-is otherwise: the empty string is a value, not an absence.
 */
function attribute(node: Record<string, unknown>, key: string): string | undefined {
  const raw = node[key];
  if (raw === undefined || raw === null) return undefined;
  // A boolean attribute (`<file viewed>`) parses as `true`; anything else is
  // already a string because attribute value parsing is off.
  return decodeXmlEntities(typeof raw === 'string' ? raw : String(raw));
}

/**
 * Read a child element's text content, decoded, or undefined when the child
 * is absent or is not plain text (it holds child elements of its own, which
 * no element of this schema does).
 */
function text(node: Record<string, unknown>, key: string): string | undefined {
  const raw = node[key];
  if (typeof raw === 'string') return decodeXmlEntities(raw);
  return undefined;
}

/**
 * `author` is a display name and absent means human, so the empty string is
 * read as absent: the serializer never writes an empty author attribute.
 */
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
