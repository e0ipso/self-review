// Browser response policy and JSON requests; no endpoint or session state.
import { SERVER_BUSY_ERROR } from '../protocol';
import { ServeRequestError } from './request-error';
import type { ServeRequester } from './requester';
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Two refusal shapes: the publisher's `{ ok: false, code, message, details }` and the validation routes' `{ error }`.
export async function requestError(
  response: Response,
  what: string,
  mutation = false
): Promise<ServeRequestError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON error body is no more informative than the status.
  }
  const unknownOutcome =
    mutation && response.status >= 500 && !(isRecord(body) && body.error === SERVER_BUSY_ERROR);
  const uncertainty = unknownOutcome ? { uncertain: true, code: 'outcome-unknown' } : {};
  if (isRecord(body)) {
    if (body.ok === false && typeof body.message === 'string') {
      return new ServeRequestError(body.message, {
        status: response.status,
        code: typeof body.code === 'string' ? body.code : null,
        details: Array.isArray(body.details)
          ? body.details.filter((line): line is string => typeof line === 'string')
          : [],
      });
    }
    if (typeof body.error === 'string') {
      return new ServeRequestError(`${what} failed (${response.status}): ${body.error}`, {
        status: response.status,
        ...uncertainty,
      });
    }
  }
  return new ServeRequestError(`${what} failed (${response.status})`, {
    status: response.status,
    ...uncertainty,
  });
}

// Response consumption stays inside the request deadline, including error bodies.
export function createClient(requester: ServeRequester) {
  return {
    getJson: <T>(path: string, signal?: AbortSignal): Promise<T> =>
      requester.request(
        path,
        { signal },
        async response => {
          if (!response.ok) throw await requestError(response, `GET ${path}`);
          return response.json() as Promise<T>;
        },
        'read'
      ),
    postJsonText: <T>(path: string, text: string, read: (response: Response) => Promise<T>) =>
      requester.request(
        path,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: text,
        },
        read,
        'mutation'
      ),
    postJson: <T>(path: string, body: unknown, signal?: AbortSignal): Promise<T> =>
      requester.request(
        path,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
          signal,
        },
        async response => {
          if (!response.ok) throw await requestError(response, `POST ${path}`);
          return response.json() as Promise<T>;
        },
        'read'
      ),
  };
}
