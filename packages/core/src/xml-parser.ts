// Compatibility entry point: file acquisition and document decoding have separate owners.
import {
  parseReviewXmlString,
  type ParsedReview,
  type ReviewXmlDecoderOptions,
} from './review-xml-decoder';
import { readReviewXmlFile, type ReviewXmlReader } from './review-xml-reader';

export { parseReviewXmlString } from './review-xml-decoder';
export type { ParsedReview, ReviewXmlDecoderOptions } from './review-xml-decoder';
export type { ReviewXmlReader } from './review-xml-reader';

export interface ParseReviewXmlOptions extends ReviewXmlDecoderOptions {
  /** Authoritative when supplied; native filesystem reads are never used as a fallback. */
  reader?: ReviewXmlReader;
}

/** Sized before reading; preserves the string decoder's typed errors and read-failed errors. */
export function parseReviewXml(xmlPath: string, options: ParseReviewXmlOptions = {}): ParsedReview {
  return parseReviewXmlString(readReviewXmlFile(xmlPath, options.reader), options);
}
