// The one close/quit/save state machine, free of Electron so tests can drive it directly.

import { ReviewPublishError } from '../../packages/core/src/review-publisher';
import type { ReviewPublishErrorCode } from '../../packages/core/src/review-publisher';
import type { ReviewState } from '../shared/types';

export type QuitPhase = 'reviewing' | 'saving' | 'quitting';

export type CloseDecision =
  | 'allow'
  /** Keep the window; the renderer shows Save & Quit / Discard / Cancel. */
  | 'ask-renderer'
  /** A save is already deciding this. */
  | 'ignore';

export class QuitController {
  private current: QuitPhase = 'reviewing';

  get phase(): QuitPhase {
    return this.current;
  }

  get mayQuit(): boolean {
    return this.current === 'quitting';
  }

  /**
   * `reviewOpen` false (welcome screen, no window) allows the close without changing phase: on macOS the
   * app outlives its last window, and a review opened later must still be asked about.
   */
  closeRequested(reviewOpen: boolean): CloseDecision {
    switch (this.current) {
      case 'quitting':
        return 'allow';
      case 'saving':
        return 'ignore';
      case 'reviewing':
        return reviewOpen ? 'ask-renderer' : 'allow';
    }
  }

  beginSave(): boolean {
    if (this.current !== 'reviewing') return false;
    this.current = 'saving';
    return true;
  }

  saveSucceeded(): void {
    this.current = 'quitting';
  }

  saveFailed(): void {
    this.current = 'reviewing';
  }

  discard(): void {
    this.current = 'quitting';
  }
}

export type SaveFailureCode = ReviewPublishErrorCode | 'no-review-state';

export interface SaveFailure {
  code: SaveFailureCode;
  message: string;
  detail: string;
}

export interface SaveAndQuitDeps {
  controller: QuitController;
  takeState: () => ReviewState | null;
  publish: (state: ReviewState) => Promise<unknown>;
  reportFailure: (failure: SaveFailure) => Promise<void> | void;
  /** Called only after the document is on disk. */
  quit: () => void;
}

export type SaveAndQuitOutcome = 'quit' | 'failed' | 'busy';

/** A missing pushed state is a failure that writes nothing, never an empty review. Any failure returns to `reviewing`. */
export async function saveAndQuit(deps: SaveAndQuitDeps): Promise<SaveAndQuitOutcome> {
  const { controller } = deps;
  if (!controller.beginSave()) return 'busy';

  const state = deps.takeState();
  if (!state) {
    controller.saveFailed();
    await deps.reportFailure({
      code: 'no-review-state',
      message: 'The review window did not hand over its review state, so nothing was written.',
      detail: 'Code: no-review-state\n\nThe review is still open. Try saving again.',
    });
    return 'failed';
  }

  let failure: SaveFailure | null = null;
  try {
    await deps.publish(state);
  } catch (error) {
    failure = describeSaveFailure(error, null);
  }

  if (failure) {
    controller.saveFailed();
    await deps.reportFailure(failure);
    return 'failed';
  }

  controller.saveSucceeded();
  deps.quit();
  return 'quit';
}

const NEXT_STEP: Record<SaveFailureCode, string> = {
  'validation-failed': 'The review was not written. Fix the problems listed above and save again.',
  'xml-illegal-character':
    'The review was not written. Remove the character named above from that comment and save again.',
  'output-is-directory':
    'Click Change... in the file tree to pick another output path, then save again.',
  'permission-denied':
    'Click Change... in the file tree to pick another output path, then save again.',
  'no-space': 'Free some disk space, or click Change... in the file tree to save elsewhere.',
  'unsafe-link': 'Click Change... in the file tree to pick another output path, then save again.',
  'unsupported-target':
    'Click Change... in the file tree to pick another output path, then save again.',
  'attachment-unavailable':
    'Click Change... to save next to the resumed review, or remove that attachment, then save again.',
  'io-error': 'The review is still open. Try saving again, or click Change... to save elsewhere.',
  'no-review-state': 'The review is still open. Try saving again.',
};

/** `outputPath` names the file when the error carries no path of its own. */
export function describeSaveFailure(error: unknown, outputPath: string | null): SaveFailure {
  if (error instanceof ReviewPublishError) {
    const lines = [`Code: ${error.code}`, `Path: ${error.path}`];
    if (error.details.length > 0) lines.push('', ...error.details);
    lines.push('', NEXT_STEP[error.code]);
    return { code: error.code, message: error.message, detail: lines.join('\n') };
  }
  const message = error instanceof Error ? error.message : String(error);
  const lines = ['Code: io-error'];
  if (outputPath) lines.push(`Path: ${outputPath}`);
  lines.push('', NEXT_STEP['io-error']);
  return {
    code: 'io-error',
    message: `Could not save the review: ${message}`,
    detail: lines.join('\n'),
  };
}
