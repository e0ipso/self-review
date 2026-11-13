// Source classification and accounting. No patch/AST formatting or diagnostic presentation.
import type { SyntheticSource } from './synthetic-source';
import {
  formatBytes,
  createRepresentationBudget,
  RepresentationLimitError,
  type ResolvedSourceBudgets,
} from './input-budgets';
import {
  overTotalReason,
  syntheticDiagnostics,
  type SyntheticDiagnosticState,
} from './synthetic-diagnostics';

export type EmittedSource = Extract<SyntheticSource, { kind: 'text' | 'symlink' | 'binary' }>;

export function createSourceAccounting(budgets: ResolvedSourceBudgets) {
  const representation = createRepresentationBudget(budgets);
  const state: SyntheticDiagnosticState = {
    representationOmissions: [],
    tooLarge: [],
    overTotal: [],
    unreadable: [],
  };
  const omitted = new Map<string, string>();
  let totalRead = 0;
  let totalExhausted = false;

  function admit(
    filePath: string,
    source: SyntheticSource | null
  ): { emit: boolean; source?: EmittedSource } {
    if (state.representationExhausted) {
      state.representationOmissions.push(filePath);
      omitted.set(filePath, state.representationExhausted);
      return { emit: true };
    }
    if (source === null) {
      // Nothing more is read once the aggregate is spent: the cut is one point in the list.
      state.overTotal.push(filePath);
      omitted.set(filePath, overTotalReason(budgets.maxTotalBytes));
      return { emit: true };
    }

    totalRead += source.bytesRead;

    switch (source.kind) {
      case 'skip':
        return { emit: false };
      case 'unreadable':
        state.unreadable.push(`${filePath} (${source.code})`);
        return { emit: false };
      case 'binary':
        return { emit: true, source };
      case 'too-large':
        state.tooLarge.push(filePath);
        omitted.set(
          filePath,
          `Not loaded: this file is ${formatBytes(source.size)}, over the ` +
            `${formatBytes(budgets.maxFileBytes)} per-file read budget.`
        );
        return { emit: true };
      case 'over-total':
        totalExhausted = true;
        state.overTotal.push(filePath);
        omitted.set(filePath, overTotalReason(budgets.maxTotalBytes));
        return { emit: true };
      case 'symlink':
      case 'text':
        return { emit: true, source };
    }
  }

  return {
    representation,
    omitted,
    admit,
    beginFile() {
      try {
        representation.beginFile();
        return true;
      } catch (error) {
        if (!(error instanceof RepresentationLimitError)) throw error;
        state.representationExhausted = `${error.message} Loading stopped; remaining paths were not loaded.`;
        return false;
      }
    },
    omitRepresentation(filePath: string, error: RepresentationLimitError) {
      if (error.aggregate) state.representationExhausted = error.message;
      state.representationOmissions.push(filePath);
      omitted.set(filePath, error.message);
    },
    remaining: () => budgets.maxTotalBytes - totalRead,
    exhausted: () => totalExhausted || state.representationExhausted !== undefined,
    diagnostics: () => syntheticDiagnostics(state, budgets),
  };
}
