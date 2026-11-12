// Serialize ReviewState to bounded XML and validate against XSD. No file I/O.

import type { DiagnosticReporter } from './diagnostics';
import { validateReviewForSerialization } from './review-state-validation';
import { ReviewState, FileReviewState, ReviewComment, Reply, Attachment } from './types';
import { planAttachments, defaultAssetName } from './attachment-planner';
import type { AssetNamer, SerializedReview } from './attachment-planner';
import { validateAgainstSchema, type ReviewSchemaValidator } from './review-xml-validator';
import type { XmlIllegalCharacterLocation } from './xml-errors';
import { ReviewXmlWriter } from './xml-writer';

export { XSD_SCHEMA } from './review-schema';
export { ASSET_DIR_NAME } from './attachment-planner';
export type { PlannedAsset, AssetNamer, SerializedReview } from './attachment-planner';

export interface SerializeOptions {
  /** Defaults to stderr for validation diagnostics. */
  reportDiagnostic?: DiagnosticReporter;
  assetName?: AssetNamer;
  /** Optional authoritative schema effect; omitted calls use xmllint. */
  validateSchema?: ReviewSchemaValidator;
}

/**
 * Pure: touches no disk (`publishReview` writes). Built before validation, so an
 * unrepresentable value is refused first.
 *
 * @throws XmlIllegalCharacterError naming the comment/reply and field.
 * @throws ReviewXmlError `input-too-large` before escaped output exceeds the resume byte
 *   budget (including publication’s final newline), or `schema-invalid`, one violation per
 *   `details` line. A validator that fails to load is deliberately not fatal: unvalidated XML
 *   after a stderr warning.
 */
export async function serializeReview(
  state: ReviewState,
  outputFilePath: string,
  options: SerializeOptions = {}
): Promise<SerializedReview> {
  state = validateReviewForSerialization(state);
  const staged = planAttachments(state, outputFilePath, options.assetName ?? defaultAssetName);
  const xml = await serializePlannedReview(
    staged.state,
    options.reportDiagnostic,
    options.validateSchema
  );
  return { xml, assets: staged.assets };
}

/** Internal publication path: references are already planned, so disk bytes never enter this module. */
export function serializePlannedReview(
  state: ReviewState,
  reportDiagnostic: DiagnosticReporter | undefined,
  validateSchema: ReviewSchemaValidator | undefined
): Promise<string>;
export function serializePlannedReview(
  state: ReviewState,
  reportDiagnostic?: DiagnosticReporter
): Promise<string>;
export async function serializePlannedReview(
  state: ReviewState,
  reportDiagnostic?: DiagnosticReporter,
  validateSchema: ReviewSchemaValidator | undefined = undefined
): Promise<string> {
  const xml = buildXml(state);
  await validateAgainstSchema(xml, reportDiagnostic, validateSchema);
  return xml;
}

function writeSourceAttributes(writer: ReviewXmlWriter, state: ReviewState): void {
  const source = state.source;
  if (source.type === 'git') {
    writer.attribute('git-diff-args', source.gitDiffArgs, { field: 'git-diff-args' });
    writer.attribute('repository', source.repository, { field: 'repository' });
  } else if (source.type === 'directory' || source.type === 'file') {
    writer.attribute('source-path', source.sourcePath, { field: 'source-path' });
  }
}

function buildXml(state: ReviewState): string {
  const writer = new ReviewXmlWriter();
  writer.append('<?xml version="1.0" encoding="UTF-8"?>\n');
  writer.append('<review xmlns="urn:self-review:v3"');
  writer.attribute('timestamp', state.timestamp, { field: 'timestamp' });
  writeSourceAttributes(writer, state);
  // Absent provenance stays omitted, preserving purely local output byte for byte.
  if (state.remoteUrl) writer.attribute('remote-url', state.remoteUrl, { field: 'remote-url' });
  if (state.remoteBaseSha)
    writer.attribute('remote-base-sha', state.remoteBaseSha, { field: 'remote-base-sha' });
  if (state.remoteHeadSha)
    writer.attribute('remote-head-sha', state.remoteHeadSha, { field: 'remote-head-sha' });
  if (state.remoteForge) writer.append(` remote-forge="${state.remoteForge}"`);
  writer.append('>\n');
  for (const file of state.files) writeFileXml(writer, file);
  writer.append('</review>');
  return writer.finish();
}

function writeFileXml(writer: ReviewXmlWriter, file: FileReviewState): void {
  writer.append('  <file');
  writer.attribute('path', file.path, { field: 'path', filePath: file.path });
  writer.append(` change-type="${file.changeType}" viewed="${file.viewed}"`);
  if (file.comments.length === 0) {
    writer.append(' />\n');
    return;
  }
  writer.append('>\n');
  for (const comment of file.comments) writeCommentXml(writer, comment, file.path);
  writer.append('  </file>\n');
}

function writeCommentXml(writer: ReviewXmlWriter, comment: ReviewComment, filePath: string): void {
  const at = (field: string): XmlIllegalCharacterLocation => ({
    field,
    filePath,
    commentId: comment.id,
  });
  writer.append('    <comment');
  if (comment.lineRange) {
    const side = comment.lineRange.side === 'old' ? 'old' : 'new';
    writer.append(` ${side}-line-start="${comment.lineRange.start}"`);
    writer.append(` ${side}-line-end="${comment.lineRange.end}"`);
  }
  if (comment.author) writer.attribute('author', comment.author, at('author'));
  if (comment.severity) writer.append(` severity="${comment.severity}"`);
  if (comment.confidence) writer.append(` confidence="${comment.confidence}"`);
  if (comment.remoteId) writer.attribute('remote-id', comment.remoteId, at('remote-id'));
  writer.append('>\n');
  writer.element('      ', 'body', comment.body, at('body'));
  writer.element('      ', 'category', comment.category, at('category'));
  if (comment.suggestion) {
    writer.append('      <suggestion>\n');
    writer.element(
      '        ',
      'original-code',
      comment.suggestion.originalCode,
      at('original-code')
    );
    writer.element(
      '        ',
      'proposed-code',
      comment.suggestion.proposedCode,
      at('proposed-code')
    );
    writer.append('      </suggestion>\n');
  }
  writeAttachments(writer, comment.attachments, '      ', at('attachment'));
  for (const reply of comment.replies ?? []) writeReplyXml(writer, reply, filePath, comment.id);
  writer.append('    </comment>\n');
}

/** The same attachment form is used under a comment and a reply. */
function writeAttachments(
  writer: ReviewXmlWriter,
  attachments: Attachment[] | undefined,
  indent: string,
  owner: XmlIllegalCharacterLocation
): void {
  for (const attachment of attachments ?? []) {
    writer.append(`${indent}<attachment`);
    writer.attribute('path', attachment.fileName, { ...owner, field: 'attachment path' });
    writer.attribute('media-type', attachment.mediaType, {
      ...owner,
      field: 'attachment media-type',
    });
    writer.append(' />\n');
  }
}

/** Replies stay flat and ordered; the root comment owns anchors and classification. */
function writeReplyXml(
  writer: ReviewXmlWriter,
  reply: Reply,
  filePath: string,
  commentId: string
): void {
  const at = (field: string): XmlIllegalCharacterLocation => ({
    field,
    filePath,
    commentId,
    replyId: reply.id,
  });
  writer.append('      <reply');
  if (reply.author) writer.attribute('author', reply.author, at('author'));
  if (reply.remoteId) writer.attribute('remote-id', reply.remoteId, at('remote-id'));
  writer.append('>\n');
  writer.element('        ', 'body', reply.body, at('body'));
  writeAttachments(writer, reply.attachments, '        ', at('attachment'));
  writer.append('      </reply>\n');
}
