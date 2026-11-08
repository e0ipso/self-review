// Typed failures of review XML reading and writing. Library code throws, hosts print
// `.message` and choose their exit; nothing here calls `process.exit`.

export type ReviewXmlErrorCode =
  | 'read-failed'
  /** Over a safety budget (input-budgets.ts): byte size or attachment count. */
  | 'input-too-large'
  | 'parse-failed'
  /** Well-formed, but with no `<review>` root element. */
  | 'missing-root'
  /** The generated document does not validate against the v3 XSD. */
  | 'schema-invalid'
  | 'xml-illegal-character';

export class ReviewXmlError extends Error {
  readonly code: ReviewXmlErrorCode;
  readonly cause?: unknown;
  /** One rendered line per problem (e.g. a schema violation with its line number). */
  readonly details: readonly string[];

  constructor(
    code: ReviewXmlErrorCode,
    message: string,
    options?: { cause?: unknown; details?: readonly string[] }
  ) {
    // Assigned, not passed to `super`: the app's tsconfig lib lacks `ErrorOptions`.
    super(message);
    this.name = 'ReviewXmlError';
    this.code = code;
    this.details = options?.details ?? [];
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

export interface XmlIllegalCharacterLocation {
  /** e.g. `body`, `original-code`, `path`, `author`. */
  field: string;
  filePath?: string;
  commentId?: string;
  replyId?: string;
}

/**
 * Thrown before anything is written: no escaped form exists, and dropping the character would
 * change the reviewer's text or a suggestion's code.
 */
export class XmlIllegalCharacterError extends ReviewXmlError {
  readonly codePoint: number;
  readonly field: string;
  readonly filePath?: string;
  readonly commentId?: string;
  readonly replyId?: string;

  constructor(codePoint: number, location: XmlIllegalCharacterLocation) {
    super('xml-illegal-character', describeIllegalCharacter(codePoint, location));
    this.name = 'XmlIllegalCharacterError';
    this.codePoint = codePoint;
    this.field = location.field;
    this.filePath = location.filePath;
    this.commentId = location.commentId;
    this.replyId = location.replyId;
  }
}

function describeIllegalCharacter(
  codePoint: number,
  location: XmlIllegalCharacterLocation
): string {
  const hex = codePoint.toString(16).toUpperCase().padStart(4, '0');
  const where = [
    location.filePath !== undefined ? `file "${location.filePath}"` : null,
    location.commentId !== undefined ? `comment ${location.commentId}` : null,
    location.replyId !== undefined ? `reply ${location.replyId}` : null,
  ]
    .filter((part): part is string => part !== null)
    .join(', ');
  return (
    `Cannot write review XML: ${location.field}${where ? ` of ${where}` : ''} contains ` +
    `U+${hex}, which XML 1.0 cannot represent. Remove the character and save again.`
  );
}
