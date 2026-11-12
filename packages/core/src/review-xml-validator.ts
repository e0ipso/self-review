// Review XML validation, including the historical infrastructure-failure fallback.
import type { DiagnosticReporter } from './diagnostics';
import { isolatedReporter } from './effect-diagnostics';
import { XSD_SCHEMA } from './review-schema';
import { ReviewXmlError } from './xml-errors';

/** A supplied validator is authoritative; throws mean unavailable infrastructure, not invalid XML. */
export type ReviewSchemaValidator = (
  xml: string,
  schema: string
) =>
  | { valid: boolean; errors?: readonly unknown[] }
  | Promise<{ valid: boolean; errors?: readonly unknown[] }>;

const defaultSchemaValidator: ReviewSchemaValidator = async (xml, schema) => {
  const { validateXML } = await import('xmllint-wasm');
  return validateXML({
    xml: [{ fileName: 'review.xml', contents: xml }],
    schema: [{ fileName: 'self-review-v3.xsd', contents: schema }],
  });
};

export function validateAgainstSchema(
  xml: string,
  reportDiagnostic: DiagnosticReporter | undefined,
  validateSchema: ReviewSchemaValidator | undefined
): Promise<void>;
/** Retain the original reflected parameters as well as the original call form. */
export function validateAgainstSchema(
  xml: string,
  reportDiagnostic?: DiagnosticReporter
): Promise<void>;
export async function validateAgainstSchema(
  xml: string,
  reportDiagnostic: DiagnosticReporter | undefined = undefined,
  validateSchema: ReviewSchemaValidator = defaultSchemaValidator
): Promise<void> {
  const report = isolatedReporter(reportDiagnostic);
  let validationResult: Awaited<ReturnType<ReviewSchemaValidator>>;
  try {
    validationResult = await validateSchema(xml, XSD_SCHEMA);
  } catch (error) {
    // Infrastructure failure (e.g. WASM load): losing a finished review is the worse outcome.
    if (error instanceof Error) {
      report(
        `[main] XML validation infrastructure failed: ${error.message} - emitting XML without validation`
      );
    } else {
      report('[main] XML validation infrastructure failed - emitting XML without validation');
    }
    return;
  }

  if (!validationResult.valid) {
    let details: string[];
    try {
      details = (validationResult.errors || []).map(formatSchemaError);
    } catch {
      // Formatting an effect's diagnostic must not replace an established schema refusal.
      details = ['Schema error details could not be formatted.'];
    }
    report('XML validation failed:');
    details.forEach(detail => report(`  ${detail}`));
    throw new ReviewXmlError(
      'schema-invalid',
      `Generated XML does not conform to schema${details.length ? `: ${details.join('; ')}` : ''}`,
      { details }
    );
  }
}

function formatSchemaError(err: unknown): string {
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object') {
    const { message, loc } = err as { message?: unknown; loc?: { lineNumber?: unknown } | null };
    const text = typeof message === 'string' ? message : JSON.stringify(err);
    const line = loc && typeof loc === 'object' ? loc.lineNumber : undefined;
    return typeof line === 'number' ? `line ${line}: ${text}` : text;
  }
  return String(err);
}
