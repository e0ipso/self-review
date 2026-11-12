import { ServeRequestError } from './request-error';
import type { DiffApiResponse } from './read-response';

interface DiffOwner {
  work: Promise<DiffApiResponse>;
  abort: AbortController;
  settled: boolean;
  legacy: boolean;
  borrowers: Set<object>;
}
const failure = (message: string) =>
  new ServeRequestError(message, {
    status: null,
    code: 'request-failed',
  });

/** Prefetch and initial pulls share one cache. A borrower's cancellation leaves other active
 * pulls intact; a legacy caller keeps the shared request alive until it settles. */
export function createSharedDiff(
  load: (signal: AbortSignal) => Promise<DiffApiResponse>,
  publish: (response: DiffApiResponse) => void
) {
  let current: DiffOwner | null = null;
  let closed = false;
  const ensure = () => {
    if (current) return current;
    const abort = new AbortController();
    const owner: DiffOwner = {
      abort,
      settled: false,
      legacy: false,
      borrowers: new Set(),
      work: load(abort.signal)
        .then(response => {
          owner.settled = true;
          if (closed || current !== owner || abort.signal.aborted)
            throw failure('The request was cancelled.');
          publish(response);
          return response;
        })
        .catch(error => {
          owner.settled = true;
          if (current === owner) current = null;
          throw error;
        }),
    };
    current = owner;
    return owner;
  };
  return {
    prefetch: () =>
      closed
        ? Promise.reject(failure('This page has disconnected from the review server.'))
        : ensure().work,
    read(signal?: AbortSignal): Promise<DiffApiResponse> {
      if (closed)
        return Promise.reject(failure('This page has disconnected from the review server.'));
      if (signal?.aborted) return Promise.reject(failure('The request was cancelled.'));
      const owner = ensure();
      if (!signal) {
        owner.legacy = true;
        return owner.work;
      }
      return new Promise((resolve, reject) => {
        const borrower = {};
        const release = () => {
          signal.removeEventListener('abort', cancel);
          owner.borrowers.delete(borrower);
        };
        const cancel = () => {
          release();
          if (!owner.settled && current === owner && !owner.legacy && !owner.borrowers.size) {
            current = null;
            owner.abort.abort();
          }
          reject(failure('The request was cancelled.'));
        };
        owner.borrowers.add(borrower);
        signal.addEventListener('abort', cancel, { once: true });
        owner.work.then(
          value => {
            release();
            resolve(value);
          },
          error => {
            release();
            reject(error);
          }
        );
        if (signal.aborted) cancel();
      });
    },
    dispose() {
      closed = true;
      const owner = current;
      current = null;
      owner?.abort.abort();
    },
  };
}
