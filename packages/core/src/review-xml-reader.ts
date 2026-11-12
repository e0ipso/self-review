// Bounded file acquisition is separate from document decoding.
import { readFileWithinBudgetSync, type BoundedReadResult } from './bounded-read';
import { formatBytes, MAX_RESUME_XML_BYTES } from './input-budgets';
import { ReviewXmlError } from './xml-errors';

export interface ReviewXmlReader {
  /** Must bound allocation and refuse non-regular inputs without blocking. Errors throw. */
  read(path: string, maxBytes: number): BoundedReadResult;
}

const nativeReader: ReviewXmlReader = { read: readFileWithinBudgetSync };

export function readReviewXmlFile(xmlPath: string, reader: ReviewXmlReader = nativeReader): string {
  let read: BoundedReadResult;
  try {
    read = reader.read(xmlPath, MAX_RESUME_XML_BYTES);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : typeof error === 'string'
          ? error
          : JSON.stringify(error);
    throw new ReviewXmlError('read-failed', `Could not read ${xmlPath}: ${message}`, {
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
  return read.content.toString('utf-8');
}
