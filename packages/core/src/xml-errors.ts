// packages/core/src/xml-errors.ts
// Typed failures of review XML reading and writing.
//
// Library code reports, hosts decide. A parse that cannot proceed throws one
// of these; the Electron main process, the serve CLI and fetch-comments each
// catch it, print `.message` to stderr and choose their own exit. Nothing in
// this package calls `process.exit`, so an embedding application never has
// its process ended by a bad resume file.

export type ReviewXmlErrorCode =
  /** The resume file could not be read from disk. */
  | 'read-failed'
  /**
   * The resume document exceeds a safety budget (input-budgets.ts): its
   * byte size, checked before it is read, or its attachment count.
   */
  | 'input-too-large'
  /** The document is not well-formed XML the parser could load. */
  | 'parse-failed'
  /** Well-formed, but with no `<review>` root element. */
  | 'missing-root'
  /** The generated document does not validate against the v3 XSD. */
  | 'schema-invalid'
  /** A text or attribute value carries a character XML 1.0 cannot represent. */
  | 'xml-illegal-character';

export class ReviewXmlError extends Error {
  readonly code: ReviewXmlErrorCode;
  /** The underlying failure, when there is one (a read or parse exception). */
  readonly cause?: unknown;
  /**
   * One line per individual problem, already rendered as text (a schema
   * violation with its line number, for instance). Empty when the message
   * says everything there is to say.
   */
  readonly details: readonly string[];

  constructor(
    code: ReviewXmlErrorCode,
    message: string,
    options?: { cause?: unknown; details?: readonly string[] }
  ) {
    // `cause` is assigned rather than passed to `super`: the app's tsconfig
    // targets a lib where `ErrorOptions` is not declared.
    super(message);
    this.name = 'ReviewXmlError';
    this.code = code;
    this.details = options?.details ?? [];
    if (options?.cause !== undefined) this.cause = options.cause;
  }
}

/** Where in the review state an illegal character was found. */
export interface XmlIllegalCharacterLocation {
  /** Name of the field, e.g. `body`, `original-code`, `path`, `author`. */
  field: string;
  /** Path of the `<file>` the value belongs to, when it belongs to one. */
  filePath?: string;
  /** Id of the owning comment, when the value belongs to a comment or reply. */
  commentId?: string;
  /** Id of the owning reply, when the value belongs to a reply. */
  replyId?: string;
}

/**
 * Thrown by the serializer, before anything is written, when a value contains
 * a character XML 1.0 forbids: a C0 control other than TAB/LF/CR, U+FFFE,
 * U+FFFF, or a lone surrogate. There is no legal escaped form for these, and
 * silently dropping them would change the reviewer's text or a suggestion's
 * code, so the serializer refuses and names the field instead.
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
