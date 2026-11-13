import type { ElectronAPI, ReviewSaveResult, ReviewState } from '../shared/types';

type PublicationAPI = Pick<ElectronAPI, 'saveReview' | 'acknowledgeReviewSave' | 'getSaveResult'>;
type LegacySaveAPI = Pick<ElectronAPI, 'submitReview' | 'saveAndQuit' | 'handoffReview'>;

/** Waiting can end without cancelling the host's write. Only an explicit refusal is retryable. */
export class DesktopPublicationError extends Error {
  constructor(
    message: string,
    readonly uncertain = true,
    readonly details: string[] = [],
    readonly handoff = false
  ) {
    super(message);
  }
}

function decodeResult(value: unknown): ReviewSaveResult | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (
    'status' in value &&
    value.status === 'saved' &&
    'receipt' in value &&
    typeof value.receipt === 'string' &&
    value.receipt.length > 0
  )
    return value as Extract<ReviewSaveResult, { status: 'saved' }>;
  if (
    'status' in value &&
    value.status === 'failed' &&
    'message' in value &&
    typeof value.message === 'string' &&
    'detail' in value &&
    typeof value.detail === 'string'
  )
    return value as Extract<ReviewSaveResult, { status: 'failed' }>;
  if ('status' in value && value.status === 'busy') return { status: 'busy' };
  return null;
}

function transportError(error: unknown, handoff = false): DesktopPublicationError {
  if (error instanceof DesktopPublicationError) return error;
  const known =
    typeof error === 'object' &&
    error !== null &&
    'uncertain' in error &&
    error.uncertain === false;
  return new DesktopPublicationError(
    error instanceof Error ? error.message : String(error),
    !known,
    [],
    handoff
  );
}

/** One protocol policy for shell Finish/Save and adapter publication. No state is replayed.
 * A caller supplies snapshot ownership; disposal only stops waiting, never rolls back a write.
 */
export function createDesktopPublicationClient(api: PublicationAPI) {
  let disposed = false;
  const pending = new Set<() => void>();
  const modern = !!(api.saveReview && api.acknowledgeReviewSave);

  function wait<T>(
    operation: (current: () => boolean) => Promise<T>,
    ownsSnapshot: () => boolean,
    handoff = false
  ): Promise<T> {
    if (disposed)
      return Promise.reject(new DesktopPublicationError('Publication client disposed.'));
    return new Promise<T>((resolve, reject) => {
      let active = true;
      const current = () => active && !disposed && ownsSnapshot();
      const finish = (complete: () => void) => {
        if (!active) return;
        active = false;
        clearTimeout(timer);
        pending.delete(stop);
        complete();
      };
      const stop = () =>
        finish(() => reject(new DesktopPublicationError('Save receipt unavailable')));
      const timer = setTimeout(stop, 60_000);
      pending.add(stop);
      // Start synchronously, preserving legacy event ordering and immediate snapshot capture.
      try {
        void operation(current).then(
          value => finish(() => resolve(value)),
          error => finish(() => reject(transportError(error, handoff)))
        );
      } catch (error) {
        finish(() => reject(transportError(error, handoff)));
      }
    });
  }

  async function accept(value: unknown, current: () => boolean): Promise<void> {
    if (!current()) throw new DesktopPublicationError('The save owner changed.');
    const result = decodeResult(value);
    if (!result) throw new DesktopPublicationError('Save receipt unavailable');
    if (result.status === 'failed')
      throw new DesktopPublicationError(result.message, false, [result.detail]);
    if (result.status === 'busy') throw new DesktopPublicationError('Another save is in progress.');
    if (!api.acknowledgeReviewSave)
      throw new DesktopPublicationError('Save acknowledgement unavailable');
    try {
      await api.acknowledgeReviewSave(result.receipt);
    } catch {
      // Publication was already committed, even if an acknowledgement claims no commit.
      throw new DesktopPublicationError('Save acknowledgement unavailable');
    }
  }

  function publish(state: ReviewState, current: () => boolean = () => true): Promise<void> {
    if (!modern) return Promise.reject(new DesktopPublicationError('Save receipt unavailable'));
    return wait(async owns => {
      if (!owns()) throw new DesktopPublicationError('The save owner changed.');
      await accept(await api.saveReview!(state), owns);
    }, current);
  }

  return {
    modern,
    canInspect: !!api.getSaveResult,
    publish,
    finish(state: ReviewState, legacy: LegacySaveAPI, current: () => boolean): Promise<void> {
      if (modern) return publish(state, current);
      return wait(async owns => {
        if (!owns()) throw new DesktopPublicationError('The save owner changed.');
        if (legacy.handoffReview) {
          try {
            await legacy.handoffReview(state);
          } catch (error) {
            throw transportError(error, true);
          }
          if (!owns()) throw new DesktopPublicationError('The save owner changed.');
        } else {
          legacy.submitReview(state);
        }
        legacy.saveAndQuit();
        throw new DesktopPublicationError('Save receipt unavailable');
      }, current);
    },
    inspect(current: () => boolean): Promise<void> {
      return wait(async owns => {
        if (!owns() || !api.getSaveResult)
          throw new DesktopPublicationError('Save receipt unavailable');
        // Inspection errors cannot prove that an earlier write did not commit.
        let result: unknown;
        try {
          result = await api.getSaveResult();
        } catch {
          throw new DesktopPublicationError('Save receipt unavailable');
        }
        await accept(result, owns);
      }, current);
    },
    stopWaiting() {
      for (const stop of pending) stop();
    },
    dispose() {
      disposed = true;
      for (const stop of pending) stop();
    },
  };
}
