// src/main/xml-parser.ts
// Parse XML review file back into ReviewComment[]

import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { ReviewComment, Suggestion, LineRange, DiffSource } from '../shared/types';

export interface ParsedReview {
  comments: ReviewComment[];
  gitDiffArgs: string;
  source: DiffSource;
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

    // Handle files array
    const files = Array.isArray(review.file)
      ? review.file
      : review.file
        ? [review.file]
        : [];

    for (const file of files) {
      const filePath = file['@_path'];
      if (!filePath) continue;

      // Handle comments array
      const fileComments = Array.isArray(file.comment)
        ? file.comment
        : file.comment
          ? [file.comment]
          : [];

      for (const comment of fileComments) {
        const reviewComment: ReviewComment = {
          id: generateId(),
          filePath,
          lineRange: parseLineRange(comment),
          body: comment.body || '',
          category: comment.category || '',
          suggestion: parseSuggestion(comment),
        };

        // Parse attachments
        const commentAttachments = Array.isArray(comment.attachment)
          ? comment.attachment
          : comment.attachment
            ? [comment.attachment]
            : [];

        if (commentAttachments.length > 0) {
          reviewComment.attachments = commentAttachments.map(
            (att: Record<string, unknown>, i: number) => ({
              id: `${reviewComment.id}-att-${i}`,
              fileName: String(att['@_path'] || ''),
              mediaType: String(att['@_media-type'] || 'image/png'),
            })
          );
        }

        comments.push(reviewComment);
      }
    }

    return { comments, gitDiffArgs, source };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error parsing XML: ${error.message}`);
    } else {
      console.error('Error parsing XML: unknown error');
    }
    process.exit(1);
  }
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

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
