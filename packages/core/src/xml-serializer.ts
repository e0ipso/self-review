// src/main/xml-serializer.ts
// Serialize ReviewState to XML and validate against XSD

import type { DiagnosticReporter } from './diagnostics';
import { validateReviewForSerialization } from './review-state-validation';
import { ReviewState, FileReviewState, ReviewComment, Reply, Attachment } from './types';
import { planAttachments, defaultAssetName } from './attachment-planner';
import type { AssetNamer, SerializedReview } from './attachment-planner';
import { validateAgainstSchema } from './review-xml-validator';
import {
  ReviewXmlError,
  XmlIllegalCharacterError,
  XmlIllegalCharacterLocation,
} from './xml-errors';
import { MAX_RESUME_XML_BYTES, formatBytes } from './input-budgets';
import { escapeXmlAttribute, escapeXmlText, findIllegalXmlCharacter } from './xml-text';

export { XSD_SCHEMA } from './review-schema';
export { ASSET_DIR_NAME } from './attachment-planner';
export type { PlannedAsset, AssetNamer, SerializedReview } from './attachment-planner';

export interface SerializeOptions {
  /** Defaults to stderr for validation diagnostics. */
  reportDiagnostic?: DiagnosticReporter;
  assetName?: AssetNamer;
}

/**
 * Pure: touches no disk (`publishReview` writes). Built before validation, so an
 * unrepresentable value is refused first.
 *
 * @throws XmlIllegalCharacterError naming the comment/reply and field.
 * @throws ReviewXmlError `schema-invalid`, one violation per `details` line. A validator
 *   that fails to load is deliberately not fatal: unvalidated XML after a stderr warning.
 */
export async function serializeReview(
  state: ReviewState,
  outputFilePath: string,
  options: SerializeOptions = {}
): Promise<SerializedReview> {
  state = validateReviewForSerialization(state);
  const staged = planAttachments(state, outputFilePath, options.assetName ?? defaultAssetName);
  const xml = await serializePlannedReview(staged.state, options.reportDiagnostic);
  return { xml, assets: staged.assets };
}

/** Internal publication path: references are already planned, so disk bytes never enter this module. */
export async function serializePlannedReview(
  state: ReviewState,
  reportDiagnostic?: DiagnosticReporter
): Promise<string> {
  const xml = buildXml(state);
  // Publication appends one newline. Its complete UTF-8 document must fit the reader's budget.
  const bytes = Buffer.byteLength(xml, 'utf8') + 1;
  if (bytes > MAX_RESUME_XML_BYTES) {
    const message =
      `The serialized review is ${formatBytes(bytes)} including its final newline, over the ` +
      `${formatBytes(MAX_RESUME_XML_BYTES)} review document limit`;
    throw new ReviewXmlError('input-too-large', message, { details: [message] });
  }
  await validateAgainstSchema(xml, reportDiagnostic);
  return xml;
}

function buildSourceAttributes(state: ReviewState): string {
  const source = state.source;
  if (source.type === 'git') {
    return ` git-diff-args="${attr(source.gitDiffArgs, { field: 'git-diff-args' })}" repository="${attr(source.repository, { field: 'repository' })}"`;
  }
  if (source.type === 'directory' || source.type === 'file') {
    return ` source-path="${attr(source.sourcePath, { field: 'source-path' })}"`;
  }
  // welcome mode: no source attributes
  return '';
}

/**
 * Remote provenance attributes on the review root. Like severity and
 * confidence on a comment, absent means "not a remote review", so each
 * attribute is emitted only when its field is set: a purely local review
 * serializes byte-identically to a document written before these existed.
 */
function buildRemoteAttributes(state: ReviewState): string {
  const attrs: string[] = [];

  if (state.remoteUrl) {
    attrs.push(`remote-url="${attr(state.remoteUrl, { field: 'remote-url' })}"`);
  }
  if (state.remoteBaseSha) {
    attrs.push(`remote-base-sha="${attr(state.remoteBaseSha, { field: 'remote-base-sha' })}"`);
  }
  if (state.remoteHeadSha) {
    attrs.push(`remote-head-sha="${attr(state.remoteHeadSha, { field: 'remote-head-sha' })}"`);
  }
  if (state.remoteForge) {
    attrs.push(`remote-forge="${state.remoteForge}"`);
  }

  return attrs.length > 0 ? ' ' + attrs.join(' ') : '';
}

function buildXml(state: ReviewState): string {
  const lines: string[] = [];

  // XML declaration
  lines.push('<?xml version="1.0" encoding="UTF-8"?>');

  // Root element with namespace
  const sourceAttrs = buildSourceAttributes(state);
  const remoteAttrs = buildRemoteAttributes(state);
  lines.push(
    `<review xmlns="urn:self-review:v3" timestamp="${attr(state.timestamp, { field: 'timestamp' })}"${sourceAttrs}${remoteAttrs}>`
  );

  // Files
  for (const file of state.files) {
    lines.push(...buildFileXml(file));
  }

  // Close root element
  lines.push('</review>');

  return lines.join('\n');
}

function buildFileXml(file: FileReviewState): string[] {
  const lines: string[] = [];
  const pathAttr = attr(file.path, { field: 'path', filePath: file.path });

  if (file.comments.length === 0) {
    // Self-closing tag for files with no comments
    lines.push(
      `  <file path="${pathAttr}" change-type="${file.changeType}" viewed="${file.viewed}" />`
    );
  } else {
    // Opening tag
    lines.push(
      `  <file path="${pathAttr}" change-type="${file.changeType}" viewed="${file.viewed}">`
    );

    // Comments
    for (const comment of file.comments) {
      lines.push(...buildCommentXml(comment, file.path));
    }

    // Closing tag
    lines.push('  </file>');
  }

  return lines;
}

function buildCommentXml(comment: ReviewComment, filePath: string): string[] {
  const lines: string[] = [];
  const attrs: string[] = [];
  const at = (field: string): XmlIllegalCharacterLocation => ({
    field,
    filePath,
    commentId: comment.id,
  });

  // Add line attributes
  if (comment.lineRange) {
    if (comment.lineRange.side === 'old') {
      attrs.push(`old-line-start="${comment.lineRange.start}"`);
      attrs.push(`old-line-end="${comment.lineRange.end}"`);
    } else {
      attrs.push(`new-line-start="${comment.lineRange.start}"`);
      attrs.push(`new-line-end="${comment.lineRange.end}"`);
    }
  }

  if (comment.author) {
    attrs.push(`author="${attr(comment.author, at('author'))}"`);
  }

  // Thresholding signals. Absent means "below any floor", so they are omitted
  // rather than defaulted when the author did not take a position.
  if (comment.severity) {
    attrs.push(`severity="${comment.severity}"`);
  }

  if (comment.confidence) {
    attrs.push(`confidence="${comment.confidence}"`);
  }

  // Remote provenance. Absent means locally authored, so it is omitted
  // rather than defaulted, exactly like the signals above.
  if (comment.remoteId) {
    attrs.push(`remote-id="${attr(comment.remoteId, at('remote-id'))}"`);
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  // Opening tag
  lines.push(`    <comment${attrStr}>`);

  // Body (preserve whitespace and newlines)
  lines.push(`      <body>${text(comment.body, at('body'))}</body>`);

  // Category (required)
  lines.push(`      <category>${text(comment.category, at('category'))}</category>`);

  // Suggestion
  if (comment.suggestion) {
    lines.push('      <suggestion>');
    lines.push(
      `        <original-code>${text(comment.suggestion.originalCode, at('original-code'))}</original-code>`
    );
    lines.push(
      `        <proposed-code>${text(comment.suggestion.proposedCode, at('proposed-code'))}</proposed-code>`
    );
    lines.push('      </suggestion>');
  }

  // Attachments
  lines.push(...buildAttachmentXml(comment.attachments, '      ', at('attachment')));

  // Replies, in array order: document order is conversation order, and it is
  // the only ordering signal a reply has.
  for (const reply of comment.replies ?? []) {
    lines.push(...buildReplyXml(reply, filePath, comment.id));
  }

  // Closing tag
  lines.push('    </comment>');

  return lines;
}

/**
 * Attachment elements are identical in form and meaning under a comment and
 * under a reply, so both call sites emit them from here.
 */
function buildAttachmentXml(
  attachments: Attachment[] | undefined,
  indent: string,
  owner: XmlIllegalCharacterLocation
): string[] {
  if (!attachments?.length) return [];

  return attachments.map(
    att =>
      `${indent}<attachment path="${attr(att.fileName, { ...owner, field: 'attachment path' })}" media-type="${attr(att.mediaType, { ...owner, field: 'attachment media-type' })}" />`
  );
}

/**
 * A reply is a flat turn in the thread: a body, optional attachments and an
 * optional author. It carries no category, severity, confidence, suggestion or
 * nested replies — those belong to the root comment, which owns the finding.
 * See ReplyType in the XSD for the reasoning.
 */
function buildReplyXml(reply: Reply, filePath: string, commentId: string): string[] {
  const attrs: string[] = [];
  const at = (field: string): XmlIllegalCharacterLocation => ({
    field,
    filePath,
    commentId,
    replyId: reply.id,
  });

  if (reply.author) {
    attrs.push(`author="${attr(reply.author, at('author'))}"`);
  }
  if (reply.remoteId) {
    attrs.push(`remote-id="${attr(reply.remoteId, at('remote-id'))}"`);
  }

  const attrStr = attrs.length > 0 ? ' ' + attrs.join(' ') : '';

  return [
    `      <reply${attrStr}>`,
    `        <body>${text(reply.body, at('body'))}</body>`,
    ...buildAttachmentXml(reply.attachments, '        ', at('attachment')),
    '      </reply>',
  ];
}

/** Escapes for element content, refusing what XML cannot carry (contract in xml-text.ts). */
function text(value: string, location: XmlIllegalCharacterLocation): string {
  return escapeXmlText(checked(value, location));
}

/** Escape a value for an attribute, refusing one XML cannot carry. */
function attr(value: string, location: XmlIllegalCharacterLocation): string {
  return escapeXmlAttribute(checked(value, location));
}

function checked(value: string, location: XmlIllegalCharacterLocation): string {
  const illegal = findIllegalXmlCharacter(value);
  if (illegal) throw new XmlIllegalCharacterError(illegal.codePoint, location);
  return value;
}
