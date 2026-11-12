// Diagnostic wording/order is independent of source classification and output format.
import { formatBytes, type ResolvedSourceBudgets } from './input-budgets';

export interface SyntheticDiagnosticState {
  representationOmissions: string[];
  representationExhausted?: string;
  tooLarge: string[];
  overTotal: string[];
  unreadable: string[];
}

export function syntheticDiagnostics(
  state: SyntheticDiagnosticState,
  budgets: ResolvedSourceBudgets
): string[] {
  const { representationOmissions, representationExhausted, tooLarge, overTotal, unreadable } =
    state;
  const diagnostics: string[] = [];
  if (representationOmissions.length > 0) {
    diagnostics.push(
      `${countFiles(representationOmissions.length)} listed without content because a representation budget ran out: ${listPaths(representationOmissions)}`
    );
  }
  if (representationExhausted) diagnostics.push(representationExhausted);
  if (tooLarge.length > 0) {
    diagnostics.push(
      `${countFiles(tooLarge.length)} over the ${formatBytes(budgets.maxFileBytes)} per-file ` +
        `read budget ${tooLarge.length === 1 ? 'is' : 'are'} listed without content: ` +
        listPaths(tooLarge)
    );
  }
  if (overTotal.length > 0) {
    diagnostics.push(
      `The ${formatBytes(budgets.maxTotalBytes)} total read budget for this review ran out; ` +
        `${countFiles(overTotal.length)} ${overTotal.length === 1 ? 'is' : 'are'} listed ` +
        `without content: ${listPaths(overTotal)}`
    );
  }
  if (unreadable.length > 0) {
    diagnostics.push(
      `${countFiles(unreadable.length)} could not be read and ` +
        `${unreadable.length === 1 ? 'is' : 'are'} not shown: ${listPaths(unreadable)}`
    );
  }

  return diagnostics;
}

/** Preserve the old parser's empty-hunk separator diagnostic without reparsing patch text. */
export function createSeparatorDiagnostics(maxDiagnostics: number) {
  let emptyBeforeNextFile: string | undefined;
  const diagnostics: string[] = [];
  return {
    diagnostics,
    next(filePath: string, lineCount?: number) {
      if (emptyBeforeNextFile !== undefined) {
        if (diagnostics.length < maxDiagnostics)
          diagnostics.push(
            `${emptyBeforeNextFile}: line beyond the counts of hunk @@ -0,0 +1,0 @@: ""`
          );
        else if (diagnostics.length === maxDiagnostics)
          diagnostics.push(
            'Further synthetic separator diagnostics omitted: diagnostic representation budget exceeded.'
          );
      }
      emptyBeforeNextFile = lineCount === 0 ? filePath : undefined;
    },
  };
}

export function overTotalReason(maxTotalBytes: number): string {
  return (
    `Not loaded: the ${formatBytes(maxTotalBytes)} total read budget for this review ` +
    'ran out before this file.'
  );
}

const LISTED_PATHS = 10;

function listPaths(paths: string[]): string {
  const shown = paths.slice(0, LISTED_PATHS).join(', ');
  const rest = paths.length - LISTED_PATHS;
  return rest > 0 ? `${shown}, and ${rest} more` : shown;
}

function countFiles(count: number): string {
  return `${count} ${count === 1 ? 'file' : 'files'}`;
}
