// src/main/xml-parser.ts
// Parse XML review file back into ReviewComment[]

import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
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

const SEVERITY_VALUES: readonly CommentSeverity[] = ['critical', 'major', 'minor', 'info'];
const CONFIDENCE_VALUES: readonly CommentConfidence[] = ['high', 'medium', 'low'];
const REMOTE_FORGE_VALUES: readonly RemoteForge[] = ['github', 'gitlab'];

export interface ParsedReview {
  comments: ReviewComment[];
  /** Paths of files the previous review marked as done (`viewed="true"`). */
  viewedFiles: string[];
  gitDiffArgs: string;
  source: DiffSource;
  // Remote provenance, read tolerantly off the review root. Undefined when
  // the document carries no remote attributes, i.e. every pre-remote and
  // purely local review.
  remoteUrl?: string;
  remoteBaseSha?: string;
  remoteHeadSha?: string;
  remoteForge?: RemoteForge;
}

export function parseReviewXml(xmlPath: string): ParsedReview {
  try {
    const xmlContent = readFileSync(xmlPath, 'utf-8');
    return parseReviewXmlString(xmlContent);
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error reading XML file: ${error.message}`);
    } else {
      console.error('Error reading XML file: unknown error');
    }
    process.exit(1);
  }
}

export function parseReviewXmlString(xmlContent: string): ParsedReview {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    trimValues: false,
  });

  try {
    const result = parser.parse(xmlContent);

    if (!result.review) {
      throw new Error('Invalid XML: missing <review> root element');
    }

    const review = result.review;
    const gitDiffArgs = review['@_git-diff-args'] || '';
    const source = parseSource(review);
    const comments: ReviewComment[] = [];
    const viewedFiles: string[] = [];

    // Handle files array
    const files = toChildArray(review.file);

    for (const file of files) {
      // Skip only when the attribute is genuinely absent: the empty string
      // is the review-level sentinel path (REVIEW_LEVEL_FILE_PATH) used by
      // fetch-comments for threads with no file anchor, and must round-trip.
      const rawPath = file['@_path'];
      if (rawPath === undefined || rawPath === null) continue;
      const filePath = String(rawPath);

      if (parseViewed(file['@_viewed'])) {
        viewedFiles.push(filePath);
      }

      // Handle comments array
      const fileComments = toChildArray(file.comment);

      for (const comment of fileComments) {
        const reviewComment: ReviewComment = {
          id: generateId(),
          filePath,
          lineRange: parseLineRange(comment),
          body: comment.body !== undefined ? String(comment.body) : '',
          category: comment.category !== undefined ? String(comment.category) : '',
          suggestion: parseSuggestion(comment),
          author: comment['@_author'] ? String(comment['@_author']) : undefined,
          severity: parseEnumAttribute(comment['@_severity'], SEVERITY_VALUES),
          confidence: parseEnumAttribute(comment['@_confidence'], CONFIDENCE_VALUES),
          remoteId: parseStringAttribute(comment['@_remote-id']),
        };

        const attachments = parseAttachments(comment, reviewComment.id);
        if (attachments) reviewComment.attachments = attachments;

        const replies = parseReplies(comment);
        if (replies) reviewComment.replies = replies;

        comments.push(reviewComment);
      }
    }

    return {
      comments,
      viewedFiles,
      gitDiffArgs,
      source,
      remoteUrl: parseStringAttribute(review['@_remote-url']),
      remoteBaseSha: parseStringAttribute(review['@_remote-base-sha']),
      remoteHeadSha: parseStringAttribute(review['@_remote-head-sha']),
      remoteForge: parseEnumAttribute(review['@_remote-forge'], REMOTE_FORGE_VALUES),
    };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error parsing XML: ${error.message}`);
    } else {
      console.error('Error parsing XML: unknown error');
    }
    process.exit(1);
  }
}

/**
 * Read an enumerated attribute, dropping values the schema does not define.
 *
 * An unrecognised value becomes undefined rather than being passed through:
 * undefined is the fail-safe reading (below every threshold floor), and it
 * keeps a resumed review serializable, since the serializer validates its
 * output against the XSD before writing.
 */
function parseEnumAttribute<T extends string>(
  raw: unknown,
  allowed: readonly T[]
): T | undefined {
  if (raw === undefined || raw === null) return undefined;
  const value = String(raw);
  return allowed.includes(value as T) ? (value as T) : undefined;
}

/**
 * Read an optional free-form string attribute, leaving absent as undefined.
 * Values are taken as-is: the remote attributes are provenance the app never
 * interprets, so there is nothing to validate on read.
 */
function parseStringAttribute(raw: unknown): string | undefined {
  return raw === undefined || raw === null ? undefined : String(raw);
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
  const sourcePath = review['@_source-path'];
  if (sourcePath) {
    return { type: 'directory', sourcePath: String(sourcePath) };
  }

  const gitDiffArgs = review['@_git-diff-args'];
  const repository = review['@_repository'];
  if (gitDiffArgs !== undefined || repository !== undefined) {
    return {
      type: 'git',
      gitDiffArgs: String(gitDiffArgs || ''),
      repository: String(repository || ''),
    };
  }

  return { type: 'welcome' };
}

function parseLineRange(comment: Record<string, unknown>): LineRange | null {
  const hasOld =
    comment['@_old-line-start'] !== undefined &&
    comment['@_old-line-end'] !== undefined;
  const hasNew =
    comment['@_new-line-start'] !== undefined &&
    comment['@_new-line-end'] !== undefined;

  if (hasOld) {
    return {
      side: 'old',
      start: parseInt(String(comment['@_old-line-start']), 10),
      end: parseInt(String(comment['@_old-line-end']), 10),
    };
  }

  if (hasNew) {
    return {
      side: 'new',
      start: parseInt(String(comment['@_new-line-start']), 10),
      end: parseInt(String(comment['@_new-line-end']), 10),
    };
  }

  return null; // File-level comment
}

function parseSuggestion(comment: Record<string, unknown>): Suggestion | null {
  if (!comment.suggestion) {
    return null;
  }

  const suggestion = comment.suggestion as Record<string, unknown>;
  return {
    originalCode: String(suggestion['original-code'] || ''),
    proposedCode: String(suggestion['proposed-code'] || ''),
  };
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
    fileName: String(att['@_path'] || ''),
    mediaType: String(att['@_media-type'] || 'image/png'),
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
      body: node.body !== undefined ? String(node.body) : '',
      author: node['@_author'] ? String(node['@_author']) : undefined,
      remoteId: parseStringAttribute(node['@_remote-id']),
    };

    const attachments = parseAttachments(node, id);
    if (attachments) reply.attachments = attachments;

    return reply;
  });
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
