// Both desktop save protocols run the same transaction; only success delivery differs.
import { createDesktopLocalization, type DesktopLocalization } from '../shared/localization';
import type { ReviewState } from '../shared/types';
import type { QuitController } from './quit-controller';
import { describeSaveFailure, type SaveFailure } from './save-failure';

interface SaveDeps {
  controller: QuitController;
  takeState: () => ReviewState | null;
  publish: (state: ReviewState) => Promise<unknown>;
  messages?: DesktopLocalization;
  outputPath?: string;
}
export type SaveOutcome =
  | { status: 'saved' }
  | { status: 'busy' }
  | { status: 'failed'; failure: SaveFailure };

/** Publication resolving means committed. No cancellation, reporting or delivery can undo it. */
export async function saveReview(deps: SaveDeps): Promise<SaveOutcome> {
  if (!deps.controller.beginSave()) return { status: 'busy' };
  const messages = deps.messages ?? createDesktopLocalization();
  try {
    const state = deps.takeState();
    if (!state) {
      deps.controller.saveFailed();
      return {
        status: 'failed',
        failure: {
          code: 'no-review-state',
          message: messages.t(
            'The review window did not hand over its review state, so nothing was written.'
          ),
          detail: `Code: no-review-state\n\n${messages.t('The review is still open. Try saving again.')}`,
        },
      };
    }
    await deps.publish(state);
    return { status: 'saved' };
  } catch (error) {
    deps.controller.saveFailed();
    return {
      status: 'failed',
      failure: describeSaveFailure(error, deps.outputPath ?? null, messages),
    };
  }
}

export interface SaveAndQuitDeps extends SaveDeps {
  reportFailure: (failure: SaveFailure) => Promise<void> | void;
  /** Called only after the document is on disk. */
  quit: () => void;
}
export type SaveAndQuitOutcome = 'quit' | 'failed' | 'busy';

export async function saveAndQuit(deps: SaveAndQuitDeps): Promise<SaveAndQuitOutcome> {
  const result = await saveReview(deps);
  if (result.status === 'busy') return 'busy';
  if (result.status === 'failed') {
    // Presentation cannot turn a recoverable refusal into global shutdown.
    try {
      await deps.reportFailure(result.failure);
    } catch {
      // The transaction already retained the review and its failure outcome.
    }
    return 'failed';
  }
  deps.controller.saveSucceeded();
  deps.quit();
  return 'quit';
}
