/** Renderer-owned requests. Reads have deadlines; writes retain an explicitly unknown outcome
 * on disposal and are never timed out or replayed. Admission bounds listeners and pending replies.
 */
export class ElectronRequests {
  private closed = false;
  private readonly pending = new Set<(error: Error) => void>();
  constructor(
    private readonly timeoutMs = 30_000,
    private readonly limit = 32
  ) {}

  run<T>(
    start: (resolve: (value: T) => void, reject: (error: unknown) => void) => (() => void) | void,
    write = false
  ): Promise<T> {
    if (this.closed) return Promise.reject(new Error('The review window was disposed.'));
    if (this.pending.size >= this.limit)
      return Promise.reject(new Error('Too many pending desktop requests.'));
    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let cleanup: (() => void) | void;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const finish = (complete: () => void) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this.pending.delete(cancel);
        cleanup?.();
        complete();
      };
      const cancel = (error: Error) =>
        finish(() =>
          reject(
            write
              ? new Error(
                  'The review window was disposed. The command outcome is unknown; it was not retried.'
                )
              : error
          )
        );
      this.pending.add(cancel);
      if (!write)
        timer = setTimeout(
          () => finish(() => reject(new Error('The desktop request timed out.'))),
          this.timeoutMs
        );
      try {
        cleanup = start(
          value => finish(() => resolve(value)),
          error => finish(() => reject(error))
        );
        if (settled) cleanup?.();
      } catch (error) {
        finish(() => reject(error));
      }
    });
  }

  receive<T>(
    subscribe: (callback: (value: T) => void) => () => void,
    request: () => void
  ): Promise<T> {
    return this.run<T>((resolve, reject) => {
      const unsubscribe = subscribe(resolve);
      try {
        request();
      } catch (error) {
        unsubscribe();
        reject(error);
      }
      return unsubscribe;
    });
  }

  invoke<T>(request: () => Promise<T>, write = false): Promise<T> {
    return this.run<T>((resolve, reject) => {
      void request().then(resolve, reject);
    }, write);
  }

  dispose(): void {
    this.closed = true;
    for (const cancel of this.pending) cancel(new Error('The review window was disposed.'));
  }
}
