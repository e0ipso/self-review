// src/main/xml-parser.ts
// Parse XML review file back into ReviewComment[]

import { readFileSync } from 'fs';
import { XMLParser } from 'fast-xml-parser';
import { ReviewComment, Suggestion, LineRange } from '../shared/types';

export interface ParsedReview {
  comments: ReviewComment[];
  gitDiffArgs: string;
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

        comments.push(reviewComment);
      }
    }

    return { comments, gitDiffArgs };
  } catch (error) {
    if (error instanceof Error) {
      console.error(`Error parsing XML: ${error.message}`);
    } else {
      console.error('Error parsing XML: unknown error');
    }
    process.exit(1);
  }
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
