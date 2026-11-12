// Cooperative loading checkpoints. Native calls and individual string operations cannot be preempted.
import { setImmediate } from 'node:timers/promises';
import { CommandCancelledError } from './forge-provider';

export function checkLoadingCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new CommandCancelledError('aborted', 'self-review', ['load-local-review']);
  }
}

/** Yield even when the preceding work completed from cache or an immediately resolved promise. */
export async function loadingCheckpoint(signal?: AbortSignal): Promise<void> {
  checkLoadingCancelled(signal);
  await setImmediate();
  checkLoadingCancelled(signal);
}
