import type { ContentLoadRefusal, ElectronAPI } from '../shared/types';
import type { ElectronRequests } from './electron-requests';

/** Old hosts answer only on the content channel; modern hosts can also refuse delivery. */
export function receiveDesktopContent<T>(
  requests: ElectronRequests,
  api: Pick<ElectronAPI, 'onContentRefused'>,
  kind: ContentLoadRefusal['kind'],
  on: (callback: (value: T) => void) => () => void,
  request: () => void
): Promise<T> {
  return receiveOwnedDesktopContent(requests, api, kind, on, request);
}

/** Cancellation releases only this waiter's listeners; main retains its admitted work. */
export function receiveOwnedDesktopContent<T>(
  requests: ElectronRequests,
  api: Pick<ElectronAPI, 'onContentRefused'>,
  kind: ContentLoadRefusal['kind'],
  on: (callback: (value: T) => void) => () => void,
  request: () => void,
  signal?: AbortSignal
): Promise<T> {
  return requests.run<T>(
    (resolve, reject) => {
      const release = on(resolve);
      let offError: (() => void) | undefined;
      const cleanup = () => {
        release();
        offError?.();
      };
      try {
        offError = api.onContentRefused?.(failure => {
          if (failure?.kind === kind)
            reject(
              new Error(
                typeof failure.message === 'string' && failure.message.length <= 2048
                  ? failure.message
                  : 'Review content could not be delivered.'
              )
            );
        });
        request();
      } catch (error) {
        cleanup();
        throw error;
      }
      return cleanup;
    },
    false,
    signal
  );
}
