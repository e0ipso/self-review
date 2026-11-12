export type RendererFailure = 'crashed' | 'unresponsive';
export interface RendererRecoveryEffects {
  isCurrent: () => boolean;
  confirmDiscard: (failure: RendererFailure) => Promise<boolean>;
  discard: (stillCurrent: () => boolean) => Promise<void>;
  invalidateState: () => void;
}

/** Only confirmed Electron failure events enter recovery. A slow close dialog is not a failure.
 * Native replies are scoped to the exact window and failure, including restoration while open.
 */
export class RendererRecovery {
  private failure: RendererFailure | null = null;
  private generation = 0;
  private disposed = false;
  private prompt: Promise<void> | null = null;
  constructor(private readonly effects: RendererRecoveryEffects) {}

  get unavailable(): boolean {
    return !this.disposed && this.failure !== null;
  }

  responsive(): void {
    if (this.failure === 'unresponsive') this.restored();
  }

  failed(reason: RendererFailure): void {
    if (this.disposed) return;
    if (this.failure !== reason) this.generation++;
    this.failure = reason;
    this.effects.invalidateState();
  }

  restored(): void {
    this.failure = null;
    this.generation++;
  }

  /** Native publication recovery must still belong to this confirmed failure when it answers. */
  captureFailure(): (() => boolean) | null {
    if (!this.unavailable || !this.effects.isCurrent()) return null;
    const generation = this.generation;
    return () => this.unavailable && this.effects.isCurrent() && this.generation === generation;
  }

  requestClose(): boolean {
    if (!this.failure || this.disposed || !this.effects.isCurrent()) return false;
    if (this.prompt) return true;
    const failure = this.failure;
    const generation = this.generation;
    const current = () =>
      !this.disposed &&
      this.effects.isCurrent() &&
      this.generation === generation &&
      this.failure === failure;
    this.prompt = Promise.resolve()
      .then(async () => {
        if (!current()) return;
        if ((await this.effects.confirmDiscard(failure)) && current())
          await this.effects.discard(current);
      })
      .catch(() => {
        console.error('[main] Renderer recovery could not complete; keeping the window open');
      })
      .finally(() => {
        this.prompt = null;
      });
    return true;
  }

  dispose(): void {
    this.disposed = true;
    this.generation++;
  }
}
