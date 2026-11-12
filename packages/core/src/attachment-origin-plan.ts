// Pure attachment reference policy and origin planning. No filesystem acquisition or runtime Core classes.
import * as path from 'node:path';
import type { ReviewComment } from './types';
import { ASSET_DIR_NAME } from './attachment-planner';

/** The bare name in `.self-review-assets/<name>`; null for any other shape. */
export function parseAttachmentReference(reference: unknown): string | null {
  if (typeof reference !== 'string') return null;
  const prefix = `${ASSET_DIR_NAME}/`;
  if (!reference.startsWith(prefix)) return null;
  const name = reference.slice(prefix.length);
  if (name === '' || name === '.' || name === '..') return null;
  if (/[/\\\0]/.test(name)) return null;
  return name;
}

export function* attachmentLists(comments: readonly ReviewComment[]) {
  for (const comment of comments) {
    if (comment.attachments) yield { comment, attachments: comment.attachments };
    for (const reply of comment.replies ?? []) {
      if (reply.attachments) yield { comment, attachments: reply.attachments };
    }
  }
}

/** The caller supplies a physically resolved directory from its own filesystem. No lookup occurs. */
export function resolveAttachmentOriginsAtDirectory(
  comments: readonly ReviewComment[],
  directory: string
): { origins: Map<string, string>; diagnostics: string[] } {
  if (!path.isAbsolute(directory))
    throw new TypeError('Attachment document directory must be absolute');
  const assetDir = path.join(directory, ASSET_DIR_NAME);
  const origins = new Map<string, string>();
  const diagnostics: string[] = [];
  for (const { comment, attachments } of attachmentLists(comments)) {
    for (const attachment of attachments) {
      const name = parseAttachmentReference(attachment.fileName);
      if (name === null) {
        diagnostics.push(
          `${comment.filePath || '(review)'}: attachment "${attachment.fileName}" is not in the ` +
            `document's ${ASSET_DIR_NAME} directory; it will not be loaded`
        );
        continue;
      }
      origins.set(attachment.fileName, path.join(assetDir, name));
    }
  }
  return { origins, diagnostics };
}
