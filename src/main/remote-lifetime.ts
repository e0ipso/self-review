import type { RemoteBootstrapResult } from '../../packages/core/src/remote-mode';

type Bootstrap = (controller: AbortController) => Promise<RemoteBootstrapResult>;

/** Owns bootstrap and its returned release handle without a handoff gap. Disposal is permanent. */
export class RemoteLifetime {
  private pending: { controller: AbortController; settled: Promise<unknown> } | null = null;
  private release: (() => Promise<void>) | null = null;
  private owned: RemoteBootstrapResult | null = null;
  private releaseForExit: (() => Promise<void>) | null = null;
  private exitPending: Promise<void> | null = null;
  private disposal: Promise<void> | null = null;
  private stopping = false;
  private releasing: Promise<void> | null = null;

  get busy(): boolean {
    return this.pending !== null;
  }
  get closed(): boolean {
    return this.stopping;
  }

  async open(
    bootstrap: Bootstrap,
    controller = new AbortController()
  ): Promise<RemoteBootstrapResult> {
    if (this.stopping || this.pending || this.release || this.releasing || this.exitPending)
      throw new Error('A remote review is already open or closing.');
    const settled = Promise.resolve()
      .then(() => bootstrap(controller))
      .then(async result => {
        this.releaseForExit = result.session.cleanupForExit ?? result.session.cleanup;
        if (this.stopping || controller.signal.aborted) {
          await this.runCleanup(result.session.cleanup);
          throw new Error('Opening the PR/MR was cancelled.');
        }
        this.release = result.session.cleanup;
        this.owned = result;
        return result;
      });
    this.pending = { controller, settled };
    try {
      return await settled;
    } finally {
      this.pending = null;
    }
  }

  ownsOpen(result: RemoteBootstrapResult): boolean {
    return !this.stopping && this.owned === result;
  }

  private runCleanup(release: () => Promise<void>): Promise<void> {
    const pending = Promise.resolve().then(() => release());
    this.exitPending = pending;
    return pending.finally(() => {
      if (this.exitPending === pending) {
        this.exitPending = null;
        this.releaseForExit = null;
      }
    });
  }

  /** Close may finish at the drain deadline, but hard exit must retain deletion already owned. */
  settleForExit(): Promise<void> {
    if (this.exitPending) return this.exitPending.catch(() => {});
    const release = this.releaseForExit;
    if (!release) return Promise.resolve();
    this.release = null;
    this.owned = null;
    this.releasing = this.runCleanup(release);
    return this.releasing
      .catch(() => console.error('[main] Remote cleanup failed'))
      .finally(() => {
        this.releasing = null;
      });
  }

  cancelOwnedOpen(expected: RemoteBootstrapResult): Promise<void> {
    // An older continuation may finish after its resource was released and another open won.
    // Scoped cancellation must never join or delete that newer owner's cleanup.
    if (this.owned !== expected) return Promise.resolve();
    return this.cancelOpen();
  }

  /** Release a declined welcome-screen open and permit another attempt. */
  async cancelOpen(): Promise<void> {
    if (this.releasing) return this.releasing;
    const release = this.release;
    this.release = null;
    this.owned = null;
    this.releasing = release ? this.runCleanup(release) : Promise.resolve();
    try {
      await this.releasing;
    } finally {
      this.releasing = null;
    }
  }

  dispose(reason: string, timeoutMs = 10_000): Promise<void> {
    if (this.disposal) return this.disposal;
    this.stopping = true;
    const pending = this.pending;
    pending?.controller.abort(new Error(reason));
    // Defer execution until disposal is installed, so repeated quit/signal callbacks share it.
    this.disposal = bounded(async () => {
      await pending?.settled.catch(() => {});
      await this.cancelOpen();
    }, timeoutMs);
    return this.disposal;
  }
}

/** A single deadline covers cancellation and release. Work can still settle after the deadline. */
async function bounded(run: () => Promise<void>, timeoutMs: number): Promise<void> {
  let timer: NodeJS.Timeout | undefined;
  try {
    await Promise.race([
      run().catch(() => console.error('[main] Remote cleanup failed')),
      new Promise<void>(resolve => {
        timer = setTimeout(() => {
          console.error(
            '[main] Remote cleanup deadline reached; closing the window and waiting for owned cleanup'
          );
          resolve();
        }, timeoutMs);
      }),
    ]);
  } finally {
    clearTimeout(timer);
  }
}

/** Exit paths close after the bounded drain, then retain owned deletion until it settles. */
export function createDesktopShutdown(
  remote: Pick<RemoteLifetime, 'dispose'> & Partial<Pick<RemoteLifetime, 'settleForExit'>>,
  exit: (code: number) => void,
  closeWindow: () => void
): (code: number, reason: string) => Promise<void> {
  let shutdown: Promise<void> | null = null;
  return (code, reason) => {
    shutdown ??= Promise.resolve().then(async () => {
      await remote.dispose(reason);
      closeWindow();
      await remote.settleForExit?.();
      exit(code);
    });
    return shutdown;
  };
}
