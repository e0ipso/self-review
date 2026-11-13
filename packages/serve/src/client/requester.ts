// One page owns its transport, deadlines and cancellation. The deadline includes
// reading the response body, since receiving headers does not complete a request.
import { ServeRequestError } from './request-error';
import { capabilityAuthorization } from '../protocol';

export type ServeOperation = 'read' | 'mutation';

// Compatibility for external three-argument callers. First-party calls always pass semantics.
// Keep until that legacy call form can be retired in a breaking release.
function legacyOperation(path: string): ServeOperation {
  return path === '/api/review' || path === '/api/apply-suggestion' ? 'mutation' : 'read';
}

export interface ServeRequester {
  request<T>(
    path: string,
    init: RequestInit,
    read: (response: Response) => Promise<T>,
    operation?: ServeOperation
  ): Promise<T>;
  dispose(): void;
}

export interface RequesterOptions {
  fetch?: typeof fetch;
  readTimeoutMs?: number;
  mutationTimeoutMs?: number;
}

export function createServeRequester(
  capability: string,
  options: RequesterOptions = {}
): ServeRequester {
  const transport = options.fetch ?? globalThis.fetch.bind(globalThis);
  const authorization = capabilityAuthorization(capability);
  const active = new Set<AbortController>();
  let disposed = false;
  return {
    async request<T>(
      path: string,
      init: RequestInit,
      read: (response: Response) => Promise<T>,
      operation: ServeOperation = legacyOperation(path)
    ) {
      const mutation = operation === 'mutation';
      const controller = new AbortController();
      const failure = (reason: string) =>
        new ServeRequestError(
          mutation
            ? `${reason} The operation may have completed. Check the terminal and destination before continuing; do not resend it blindly.`
            : reason,
          {
            status: null,
            code: mutation ? 'outcome-unknown' : 'request-failed',
            uncertain: mutation,
          }
        );
      if (disposed) throw failure('This page has disconnected from the review server.');
      if (init.signal?.aborted) throw failure('The request was cancelled.');
      active.add(controller);
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort = () => {};
      const onExternalAbort = () => controller.abort(init.signal?.reason);
      try {
        const cancelled = new Promise<never>((_, reject) => {
          onAbort = () => reject(failure('The request was cancelled or timed out.'));
          controller.signal.addEventListener('abort', onAbort, { once: true });
          timer = setTimeout(
            () => controller.abort(),
            mutation ? (options.mutationTimeoutMs ?? 60_000) : (options.readTimeoutMs ?? 30_000)
          );
        });
        init.signal?.addEventListener('abort', onExternalAbort, { once: true });
        if (init.signal?.aborted) onExternalAbort();
        return await Promise.race([
          cancelled,
          (async () => {
            controller.signal.throwIfAborted();
            const headers = new Headers(init.headers);
            headers.set('authorization', authorization);
            const response = await transport(path, {
              ...init,
              signal: controller.signal,
              headers: Object.fromEntries(headers.entries()),
            });
            return read(response);
          })(),
        ]);
      } catch (error) {
        if (error instanceof ServeRequestError) throw error;
        throw failure(error instanceof Error ? error.message : String(error));
      } finally {
        clearTimeout(timer);
        controller.signal.removeEventListener('abort', onAbort);
        init.signal?.removeEventListener('abort', onExternalAbort);
        active.delete(controller);
      }
    },
    dispose() {
      disposed = true;
      for (const controller of active) controller.abort();
      active.clear();
    },
  };
}
