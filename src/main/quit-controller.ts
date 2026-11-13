// The one close/quit/save state machine, free of Electron so tests can drive it directly.

export { describeSaveFailure } from './save-failure';
export type { SaveFailureCode, SaveFailure } from './save-failure';
export { saveAndQuit } from './save-transaction';
export type { SaveAndQuitDeps, SaveAndQuitOutcome } from './save-transaction';

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
