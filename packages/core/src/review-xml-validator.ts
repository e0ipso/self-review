// Review XML validation, including the historical infrastructure-failure fallback.
import { stderrReporter, type DiagnosticReporter } from './diagnostics';
import { validateXML } from 'xmllint-wasm';
import { XSD_SCHEMA } from './review-schema';
import { ReviewXmlError } from './xml-errors';

export async function validateAgainstSchema(
  xml: string,
  reportDiagnostic: DiagnosticReporter = stderrReporter
): Promise<void> {
  let validationResult: Awaited<ReturnType<typeof validateXML>>;
  try {
    validationResult = await validateXML({
      xml: [{ fileName: 'review.xml', contents: xml }],
      schema: [{ fileName: 'self-review-v3.xsd', contents: XSD_SCHEMA }],
    });
  } catch (error) {
    // Infrastructure failure (e.g. WASM load): losing a finished review is the worse outcome.
    if (error instanceof Error) {
      reportDiagnostic(
        `[main] XML validation infrastructure failed: ${error.message} - emitting XML without validation`
      );
    } else {
      reportDiagnostic(
        '[main] XML validation infrastructure failed - emitting XML without validation'
      );
    }
    return;
  }

  if (!validationResult.valid) {
    const details = (validationResult.errors || []).map(formatSchemaError);
    reportDiagnostic('XML validation failed:');
    details.forEach(detail => reportDiagnostic(`  ${detail}`));
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
