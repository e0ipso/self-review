// src/main/quit-controller.ts
// The desktop app's one close/quit/save state machine, kept free of Electron
// so it can be exercised directly. main.ts owns the wiring: every way out of
// the app — the window's close button, menu Quit, Cmd+Q/Ctrl+Q, Finish
// Review, the Save & Quit / Discard dialog — consults the same controller,
// and only a successful save or an explicit discard lets the process exit.

import { ReviewPublishError } from '../../packages/core/src/review-publisher';
import type { ReviewPublishErrorCode } from '../../packages/core/src/review-publisher';
import type { ReviewState } from '../shared/types';

export type QuitPhase =
  /** A review may be open; nothing has been decided. */
  | 'reviewing'
  /** A save is in flight. Close requests wait for its outcome. */
  | 'saving'
  /** The reviewer saved or discarded; the next close or quit goes through. */
  | 'quitting';

export type CloseDecision =
  /** Let Electron close the window / quit the app. */
  | 'allow'
  /** Keep the window; ask the renderer to show Save & Quit / Discard / Cancel. */
  | 'ask-renderer'
  /** Keep the window and do nothing: a save is already deciding this. */
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
   * A window close or an app quit was requested. `reviewOpen` is whether a
   * review window with something to lose exists; without one (welcome
   * screen, no window) the close goes straight through, and deliberately
   * without changing phase: on macOS the app outlives its last window, and a
   * review opened in a later window must still be asked about.
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

  /** True when a save may start now; false while one is in flight or after the decision is made. */
  beginSave(): boolean {
    if (this.current !== 'reviewing') return false;
    this.current = 'saving';
    return true;
  }

  saveSucceeded(): void {
    this.current = 'quitting';
  }

  /** The review stays open, exactly as it was, and may be saved again. */
  saveFailed(): void {
    this.current = 'reviewing';
  }

  discard(): void {
    this.current = 'quitting';
  }
}

export type SaveFailureCode = ReviewPublishErrorCode | 'no-review-state';

/** What the reviewer is shown when a save does not happen. */
export interface SaveFailure {
  code: SaveFailureCode;
  /** One line: what went wrong. */
  message: string;
  /** The code, every detail line the publisher rendered, and what to do next. */
  detail: string;
}

export interface SaveAndQuitDeps {
  controller: QuitController;
  /** The state the renderer pushed before asking to save; null when it did not. */
  takeState: () => ReviewState | null;
  /** Publishes the document; throws (ideally a ReviewPublishError) when it cannot. */
  publish: (state: ReviewState) => Promise<unknown>;
  /** Shows the failure and returns once the reviewer has seen it. */
  reportFailure: (failure: SaveFailure) => Promise<void> | void;
  /** Ends the process. Called only after the document is on disk. */
  quit: () => void;
}

export type SaveAndQuitOutcome = 'quit' | 'failed' | 'busy';

/**
 * Finish Review and Save & Quit. The state must have been pushed over
 * `review:submit` first; a missing state is a failure that writes nothing,
 * never an empty review. On any failure the controller returns to
 * `reviewing`, the failure is reported, and nothing exits: the live review
 * and its comments are untouched, and the reviewer may change the output
 * path and try again.
 */
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

/**
 * Renders a publish failure for the error dialog. `outputPath` names the
 * file when the error does not carry a path of its own.
 */
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
