import type { BrowserWindow } from 'electron';

/** A committed publication can outlive a crashed renderer's missing receipt. Only a native
 * confirmation for that exact window/failure or a replaced renderer can complete it.
 * A slow healthy peer never does.
 */
export class PublishedReviewRecovery {
  private publishedWindow: BrowserWindow | null = null;
  private publishedFrame: unknown;
  private pending = false;
  constructor(
    private readonly effects: {
      getWindow: () => BrowserWindow | null;
      captureFailure: () => (() => boolean) | null;
      confirm: (window: BrowserWindow) => Promise<boolean>;
      quit: () => void;
    }
  ) {}

  record(window: BrowserWindow | null, frame = window?.webContents?.mainFrame): void {
    if (window && window === this.effects.getWindow()) {
      this.publishedWindow = window;
      this.publishedFrame = frame;
    }
  }
  requestClose(): boolean {
    const window = this.effects.getWindow();
    const failed = this.effects.captureFailure();
    if (!window || window !== this.publishedWindow) return false;
    const frame = window.webContents?.mainFrame;
    const replaced = frame !== this.publishedFrame;
    if (!failed && !replaced) return false;
    if (this.pending) return true;
    this.pending = true;
    const current = () =>
      !window.isDestroyed() &&
      window === this.effects.getWindow() &&
      window.webContents?.mainFrame === frame &&
      (failed ? failed() : replaced);
    void Promise.resolve()
      .then(async () => {
        if (current() && (await this.effects.confirm(window)) && current()) this.effects.quit();
      })
      .catch(() => {
        console.error('[main] Could not confirm the saved review; keeping the window open');
      })
      .finally(() => {
        this.pending = false;
      });
    return true;
  }
}
