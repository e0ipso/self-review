/** The initial window is created only after startup and handler registration have finished. */
export interface OwnedWindow {
  isDestroyed(): boolean;
  isMinimized(): boolean;
  restore(): void;
  focus(): void;
  on(event: 'closed', listener: () => void): unknown;
}

export class WindowOwner<T extends OwnedWindow> {
  private window: T | null = null;
  private ready = false;
  private stopped = false;
  constructor(private readonly create: () => T) {}

  get current(): T | null {
    return this.window && !this.window.isDestroyed() ? this.window : null;
  }

  initialize(): void {
    this.ready = true;
    this.activate();
  }

  stop(): void {
    this.stopped = true;
  }

  activate(): void {
    if (!this.ready || this.stopped) return;
    const existing = this.current;
    if (existing) {
      if (existing.isMinimized()) existing.restore();
      existing.focus();
      return;
    }
    const window = this.create();
    this.window = window;
    window.on('closed', () => {
      if (this.window === window) this.window = null;
    });
  }
}
