// Runtime boundary for review DTOs, shared by transports and XML publication.
// Validated DTOs retain supported optional metadata, extension fields and binary assets.

import type { ReviewState } from './types';
import { validateLineRange } from './anchor-validation';
import { ReviewXmlError } from './xml-errors';

/**
 * Validate the complete in-memory DTO without I/O. Unknown extension fields are retained.
 * Historical submissions may omit nullable anchors/suggestions; the returned DTO defaults them to null.
 * Already complete DTOs are returned unchanged.
 * Hosts can catch ReviewXmlError (`invalid-state`) before accepting a submission. Serialization and
 * publication use the same boundary, including when the XSD validator is unavailable.
 */
export function validateReviewState(value: unknown): ReviewState {
  validateState(value, true);
  return normalizeNullableFields(value as ReviewState);
}

/** Existing serializers accept a missing transient comment id and use an empty asset prefix. */
export function validateReviewForSerialization(state: ReviewState): ReviewState {
  validateState(state, false);
  return normalizeNullableFields(state);
}

function validateState(value: unknown, requireCommentIds: boolean): void {
  const state = record(value, 'review');
  string(state.timestamp, 'review.timestamp');
  const source = record(state.source, 'review.source');
  switch (source.type) {
    case 'git':
      string(source.gitDiffArgs, 'review.source.gitDiffArgs');
      string(source.repository, 'review.source.repository');
      break;
    case 'directory':
    case 'file':
      string(source.sourcePath, 'review.source.sourcePath');
      break;
    case 'welcome':
    case 'loading':
      break;
    default:
      invalid('review.source.type', 'must be git, directory, file, welcome or loading');
  }
  for (const key of ['remoteUrl', 'remoteBaseSha', 'remoteHeadSha'])
    optionalString(state, key, 'review');
  optionalEnum(state, 'remoteForge', ['github', 'gitlab'], 'review');
  array(state.files, 'review.files').forEach((value, index) => {
    const at = `review.files[${index}]`;
    const file = record(value, at);
    string(file.path, `${at}.path`);
    enumValue(
      file.changeType,
      ['added', 'modified', 'deleted', 'renamed', 'copied'],
      `${at}.changeType`
    );
    boolean(file.viewed, `${at}.viewed`);
    array(file.comments, `${at}.comments`).forEach((comment, index) =>
      validateComment(comment, `${at}.comments[${index}]`, requireCommentIds)
    );
  });
}

function validateComment(value: unknown, at: string, requireId: boolean): void {
  const comment = record(value, at);
  if (requireId || comment.id !== undefined) string(comment.id, `${at}.id`);
  for (const key of ['filePath', 'body', 'category']) string(comment[key], `${at}.${key}`);
  for (const key of ['author', 'remoteId']) optionalString(comment, key, at);
  optionalEnum(comment, 'severity', ['critical', 'major', 'minor', 'info'], at);
  optionalEnum(comment, 'confidence', ['high', 'medium', 'low'], at);
  if (comment.orphaned !== undefined) boolean(comment.orphaned, `${at}.orphaned`);
  if (comment.lineRange !== null && comment.lineRange !== undefined) {
    const range = record(comment.lineRange, `${at}.lineRange`);
    enumValue(range.side, ['old', 'new'], `${at}.lineRange.side`);
    if (typeof range.start !== 'number' || typeof range.end !== 'number')
      invalid(`${at}.lineRange`, 'bounds must be numbers');
    const checked = validateLineRange({
      side: range.side as 'old' | 'new',
      start: range.start as number,
      end: range.end as number,
    });
    if (!checked.ok) invalid(`${at}.lineRange`, checked.reason);
  }
  if (comment.suggestion !== null && comment.suggestion !== undefined) {
    const suggestion = record(comment.suggestion, `${at}.suggestion`);
    string(suggestion.originalCode, `${at}.suggestion.originalCode`);
    string(suggestion.proposedCode, `${at}.suggestion.proposedCode`);
    if (comment.lineRange === null || comment.lineRange === undefined)
      invalid(`${at}.suggestion`, 'requires a line anchor');
  }
  validateAttachments(comment.attachments, `${at}.attachments`);
  if (comment.replies !== undefined) {
    array(comment.replies, `${at}.replies`).forEach((value, index) => {
      const replyAt = `${at}.replies[${index}]`;
      const reply = record(value, replyAt);
      string(reply.id, `${replyAt}.id`);
      string(reply.body, `${replyAt}.body`);
      for (const key of ['author', 'remoteId']) optionalString(reply, key, replyAt);
      validateAttachments(reply.attachments, `${replyAt}.attachments`);
    });
  }
}

function validateAttachments(value: unknown, at: string): void {
  if (value === undefined) return;
  array(value, at).forEach((value, index) => {
    const attachmentAt = `${at}[${index}]`;
    const attachment = record(value, attachmentAt);
    for (const key of ['id', 'fileName', 'mediaType'])
      string(attachment[key], `${attachmentAt}.${key}`);
    if (attachment.data !== undefined && !(attachment.data instanceof ArrayBuffer))
      invalid(`${attachmentAt}.data`, 'must be an ArrayBuffer');
  });
}

function record(value: unknown, at: string): Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value))
    invalid(at, 'must be an object');
  return value as Record<string, unknown>;
}

function array(value: unknown, at: string): unknown[] {
  if (!Array.isArray(value)) invalid(at, 'must be an array');
  for (let index = 0; index < value.length; index++) {
    if (!(index in value)) invalid(`${at}[${index}]`, 'must be present');
  }
  return value;
}

function string(value: unknown, at: string): void {
  if (typeof value !== 'string') invalid(at, 'must be a string');
}

function boolean(value: unknown, at: string): void {
  if (typeof value !== 'boolean') invalid(at, 'must be a boolean');
}

function optionalString(node: Record<string, unknown>, key: string, at: string): void {
  if (node[key] !== undefined) string(node[key], `${at}.${key}`);
}

function enumValue(value: unknown, allowed: readonly string[], at: string): void {
  if (typeof value !== 'string' || !allowed.includes(value))
    invalid(at, `must be one of ${allowed.join(', ')}`);
}

function optionalEnum(
  node: Record<string, unknown>,
  key: string,
  allowed: readonly string[],
  at: string
): void {
  if (node[key] !== undefined) enumValue(node[key], allowed, `${at}.${key}`);
}

function invalid(at: string, reason: string): never {
  const message = `Invalid review state: ${at} ${reason}`;
  throw new ReviewXmlError('invalid-state', message, { details: [message] });
}

/** Only copy branches with historical omissions; buffers and extension fields keep their identity. */
function normalizeNullableFields(state: ReviewState): ReviewState {
  const files = state.files.map(file => {
    const comments = file.comments.map(comment =>
      comment.lineRange === undefined || comment.suggestion === undefined
        ? {
            ...comment,
            lineRange: comment.lineRange ?? null,
            suggestion: comment.suggestion ?? null,
          }
        : comment
    );
    return comments.some((comment, index) => comment !== file.comments[index])
      ? { ...file, comments }
      : file;
  });
  return files.some((file, index) => file !== state.files[index]) ? { ...state, files } : state;
}
