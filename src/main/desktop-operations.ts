/** Main-thread ownership of startup and window work. No queue and no write retries.
 * A cancelled operation keeps its admission until it settles, including noninterruptible I/O.
 */
export class DesktopOperations {
  private readonly lifetime = new AbortController();
  private window = new AbortController();
  private readonly pending = new Set<Promise<unknown>>();
  private mutation: Promise<unknown> | null = null;
  private mutationAbort: AbortController | null = null;
  private completing = false;
  private disposal: Promise<void> | null = null;
  constructor(private readonly limit = 32) {}

  get signal(): AbortSignal {
    return this.lifetime.signal;
  }
  get finishing(): boolean {
    return this.completing;
  }
  get busy(): boolean {
    return this.mutation !== null || this.completing;
  }

  /** The caller registers this cancellation with exactly the window it just created. */
  replaceWindow(): (reason: Error) => void {
    this.window.abort(new Error('The review window was replaced.'));
    const owner = new AbortController();
    this.window = owner;
    return reason => owner.abort(reason);
  }

  private admit(): void {
    this.signal.throwIfAborted();
    this.window.signal.throwIfAborted();
    if (this.completing) throw new Error('The review is finishing.');
    if (this.pending.size >= this.limit) throw new Error('Too many pending desktop operations.');
  }

  private track<T>(run: () => Promise<T>): Promise<T> {
    // Start on the next microtask so ownership is installed before any continuation can finish.
    const work = Promise.resolve().then(run);
    this.pending.add(work);
    void work.then(
      () => this.pending.delete(work),
      () => this.pending.delete(work)
    );
    return work;
  }

  read<T>(run: (signal: AbortSignal) => Promise<T>, timeoutMs = 30_000): Promise<T> {
    try {
      this.admit();
    } catch (error) {
      return Promise.reject(error);
    }
    const deadline = new AbortController();
    const signal = AbortSignal.any([this.signal, this.window.signal, deadline.signal]);
    const timer = setTimeout(
      () => deadline.abort(new Error('The desktop operation timed out.')),
      timeoutMs
    );
    return this.track(async () => {
      try {
        signal.throwIfAborted();
        const value = await run(signal);
        signal.throwIfAborted();
        return value;
      } finally {
        clearTimeout(timer);
      }
    });
  }

  apply<T>(run: (signal: AbortSignal) => Promise<T>): Promise<T> {
    try {
      this.admit();
      if (this.mutation) throw new Error('A source change is already in progress.');
    } catch (error) {
      return Promise.reject(error);
    }
    const abort = new AbortController();
    const signal = AbortSignal.any([this.signal, this.window.signal, abort.signal]);
    const work = this.track(async () => {
      signal.throwIfAborted();
      // No post-result cancellation check: rename may already have committed successfully.
      return run(signal);
    });
    this.mutation = work;
    this.mutationAbort = abort;
    const settled = () => {
      if (this.mutation === work) {
        this.mutation = null;
        this.mutationAbort = null;
      }
    };
    void work.then(settled, settled);
    return work;
  }

  /** Reserve completion admission even when reads are full. Apply settles before save/discard;
   * reads are cancelled and drained by shutdown after the decision. Explicit discard cancels Apply. */
  complete<T>(run: (signal: AbortSignal) => Promise<T>, cancelApply = false): Promise<T> {
    try {
      this.signal.throwIfAborted();
      this.window.signal.throwIfAborted();
      if (this.completing) throw new Error('The review is finishing.');
    } catch (error) {
      return Promise.reject(error);
    }
    this.completing = true;
    const earlier = this.mutation;
    if (cancelApply) this.mutationAbort?.abort(new Error('The review was discarded.'));
    const signal = AbortSignal.any([this.signal, this.window.signal]);
    return this.track(async () => {
      try {
        await earlier?.catch(() => {});
        signal.throwIfAborted();
        return await run(signal);
      } finally {
        this.completing = false;
      }
    });
  }

  dispose(reason: string, timeoutMs = 10_000): Promise<void> {
    if (this.disposal) return this.disposal;
    this.lifetime.abort(new Error(reason));
    const pending = [...this.pending];
    this.disposal = (async () => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      try {
        await Promise.race([
          Promise.allSettled(pending),
          new Promise<void>(resolve => {
            timer = setTimeout(() => {
              console.error('[main] Operation drain deadline reached; exiting');
              resolve();
            }, timeoutMs);
          }),
        ]);
      } finally {
        clearTimeout(timer);
      }
    })();
    return this.disposal;
  }
}
