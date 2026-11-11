// A `ReviewAdapter` over `fetch`: transport only, since every component the
// browser renders already lives in `@self-review/react`.
//
// Five deliberate properties. `changeOutputPath` is absent, not stubbed —
// `FileTree` renders its control on the property's presence, so a stub would
// draw a dead button. `chooseApplyDestination` is absent for a stronger reason:
// the UI only asks for a destination when the session is a temporary remote
// clone, and serve mode has no remote mode, so the case cannot arise.
// `GET /api/diff` is shared, with explicit retry after failure, carrying the diff and
// guide, so there is no push transport. `submitReview` resolving means the review is on disk. The
// capability token lives only in this closure, never in storage or a URL.

// Type-only, erased at build time: no runtime dependency on either package.
import type { ReviewAdapter, GuideLoadPayload } from '@self-review/react';
import type {
  AppConfig,
  Attachment,
  DiffHunk,
  DiffLoadPayload,
  ExpandContextRequest,
  ExpandContextResponse,
  ImageLoadResult,
  OutputPathInfo,
  ResumeLoadPayload,
  ReviewState,
} from '@self-review/core';
import {
  SERVER_BUSY_ERROR,
  MAX_REVIEW_BODY_BYTES,
  MAX_APPLY_BODY_BYTES,
  SUGGESTION_TOO_LARGE_CODE,
  REVIEW_TOO_LARGE_CODE,
  formatMegabytes,
} from '../protocol';
import type { ReviewSubmitAck } from '../protocol';

/** What `GET /api/diff` answers: both halves of the initial session. */
interface DiffApiResponse {
  diff: DiffLoadPayload;
  guide: GuideLoadPayload | null;
}

/** What `GET /api/config` answers. */
export interface ConfigApiResponse {
  config: AppConfig;
  outputPathInfo: OutputPathInfo | null;
}

import { ServeRequestError } from './request-error';
import { createServeRequester, type ServeRequester } from './requester';
export { ServeRequestError } from './request-error';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

// Two refusal shapes: the publisher's `{ ok: false, code, message, details }` and the validation routes' `{ error }`.
async function requestError(
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
function createClient(requester: ServeRequester) {
  return {
    getJson: <T>(path: string): Promise<T> =>
      requester.request(path, {}, async response => {
        if (!response.ok) throw await requestError(response, `GET ${path}`);
        return response.json() as Promise<T>;
      }),
    postJsonText: <T>(path: string, text: string, read: (response: Response) => Promise<T>) =>
      requester.request(
        path,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: text,
        },
        read
      ),
    postJson: <T>(path: string, body: unknown): Promise<T> =>
      requester.request(
        path,
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(body),
        },
        async response => {
          if (!response.ok) throw await requestError(response, `POST ${path}`);
          return response.json() as Promise<T>;
        }
      ),
  };
}

// ---------------------------------------------------------------------------
// Attachment blobs on the wire.
//
// `Attachment.data` is an `ArrayBuffer`, and `JSON.stringify` renders one as
// `{}`. Submitting a review with an image straight through the JSON body
// would therefore write a zero-byte file — with a 200, and no error anywhere.
// The bytes go base64-encoded in `dataBase64` instead; `parseReviewStateBody`
// in ../validate.ts decodes them back and rejects a raw `data` field, so a
// client that forgets this fails loudly rather than silently.
// ---------------------------------------------------------------------------

/** `String.fromCharCode` is applied to a slice at a time; spreading a whole
 * multi-megabyte screenshot in one call overflows the argument stack. */
const BASE64_CHUNK_BYTES = 0x8000;

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += BASE64_CHUNK_BYTES) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES));
  }
  return btoa(binary);
}

/**
 * Encode one attachment list for the wire. An attachment with no blob — a
 * resumed one, whose bytes are read back through `GET /api/attachment` —
 * passes through as it is.
 */
function encodeAttachments(attachments: Attachment[]): unknown[] {
  return attachments.map(attachment => {
    const { data, ...rest } = attachment;
    if (!data || data.byteLength === 0) return rest;
    return { ...rest, dataBase64: arrayBufferToBase64(data) };
  });
}

/**
 * Rewrite a review state into the JSON body `POST /api/review` accepts:
 * attachment blobs base64-encoded, and only the three top-level fields the
 * server takes (it rejects an unknown key with 400, and remote provenance is
 * injected server-side, exactly as the desktop injects it in main).
 */
export function encodeReviewStateForWire(state: ReviewState): unknown {
  return {
    timestamp: state.timestamp,
    source: state.source,
    files: state.files.map(file => ({
      ...file,
      comments: file.comments.map(comment => ({
        ...comment,
        ...(comment.attachments ? { attachments: encodeAttachments(comment.attachments) } : {}),
        ...(comment.replies
          ? {
              replies: comment.replies.map(reply => ({
                ...reply,
                ...(reply.attachments ? { attachments: encodeAttachments(reply.attachments) } : {}),
              })),
            }
          : {}),
      })),
    })),
  };
}

// The size is measured before sending: base64 can push a review over the limit while it is well under on disk,
// and the server's 413 arrives after it closed the socket.
function tooLarge(bytes: number, status: number | null): ServeRequestError {
  return new ServeRequestError(
    `This review is ${formatMegabytes(bytes)} MB as sent, over the server's ` +
      `${formatMegabytes(MAX_REVIEW_BODY_BYTES)} MB limit. Image attachments are the usual ` +
      'cause — they are base64-encoded on the wire, which adds a third — so remove or shrink ' +
      'some and press Finish Review again. Nothing has been lost.',
    { status, code: REVIEW_TOO_LARGE_CODE }
  );
}

function byteLength(text: string): number {
  return new Blob([text]).size;
}

/** Path-bearing routes take the path as a query parameter, encoded once. */
function withPath(route: string, filePath: string): string {
  return `${route}?path=${encodeURIComponent(filePath)}`;
}

/** Read the config and its output path info. Fetched before the UI mounts. */
export async function loadServeConfig(
  capability: string,
  requester = createServeRequester(capability)
): Promise<ConfigApiResponse | null> {
  return createClient(requester).getJson<ConfigApiResponse | null>('/api/config');
}

/**
 * Build the adapter for one page load.
 *
 * A factory rather than a module-level object because the shared
 * `GET /api/diff` promise is per-session state; a test gets a fresh one per
 * case, and the page creates exactly one.
 */
export interface FetchReviewAdapter extends ReviewAdapter {
  dispose(): void;
}

export function createFetchAdapter(
  capability: string,
  requester = createServeRequester(capability)
): FetchReviewAdapter {
  const { getJson, postJson, postJsonText } = createClient(requester);
  let diffRequest: Promise<DiffApiResponse> | null = null;
  let loaded: DiffApiResponse | null = null;
  let disposed = false;
  const subscriptions = new Set<(response: DiffApiResponse) => void>();

  function requestDiff(): Promise<DiffApiResponse> {
    if (diffRequest) return diffRequest;
    const request = getJson<DiffApiResponse | null>('/api/diff')
      .then(response => {
        if (response === null) throw new Error('The server has no diff to review');
        if (!disposed) {
          loaded = response;
          for (const deliver of [...subscriptions]) {
            if (subscriptions.has(deliver)) deliver(response);
          }
        }
        return response;
      })
      .catch(error => {
        if (diffRequest === request) diffRequest = null;
        throw error;
      });
    diffRequest = request;
    return request;
  }

  function subscribe<T>(
    select: (response: DiffApiResponse) => T | null,
    callback: (value: T) => void
  ): () => void {
    const deliver = (response: DiffApiResponse) => {
      const value = select(response);
      if (value !== null) callback(value);
    };
    subscriptions.add(deliver);
    if (loaded) {
      const response = loaded;
      void Promise.resolve().then(() => {
        if (!disposed && subscriptions.has(deliver)) deliver(response);
      });
    } else {
      // loadDiff exposes errors. Keep subscribers for an explicit retry.
      void requestDiff().catch(() => {});
    }
    return () => {
      subscriptions.delete(deliver);
    };
  }

  const publishReview = async (state: ReviewState): Promise<void> => {
    const text = JSON.stringify(encodeReviewStateForWire(state));
    const bytes = byteLength(text);
    if (bytes > MAX_REVIEW_BODY_BYTES) {
      throw tooLarge(bytes, null);
    }
    return postJsonText('/api/review', text, async response => {
      if (response.status === 413) {
        throw tooLarge(bytes, response.status);
      }
      if (!response.ok) {
        throw await requestError(response, 'POST /api/review', true);
      }
      const ack = (await response.json()) as ReviewSubmitAck | null;
      if (!isRecord(ack) || ack.ok !== true) {
        throw new ServeRequestError(
          'The server answered without acknowledging the review as written. ' +
            'Check the terminal and output file before continuing; do not resend blindly.',
          { status: response.status, code: 'outcome-unknown', uncertain: true }
        );
      }
    });
  };

  return {
    dispose: () => {
      disposed = true;
      subscriptions.clear();
      requester.dispose();
    },
    loadDiff: async (): Promise<DiffLoadPayload> => (await requestDiff()).diff,

    loadResumedReview: async (): Promise<ResumeLoadPayload> =>
      // The route answers null when there is nothing to resume; an empty
      // payload says the same thing in the shape the interface promises.
      (await getJson<ResumeLoadPayload | null>('/api/resume')) ?? {
        comments: [],
        viewedFiles: [],
      },

    applySuggestion: async request => {
      const text = JSON.stringify(request);
      const bytes = byteLength(text);
      const tooLarge = (status: number | null) =>
        new ServeRequestError(
          `This suggestion is ${formatMegabytes(bytes)} MB as sent, over the server's ` +
            `${formatMegabytes(MAX_APPLY_BODY_BYTES)} MB limit. Shorten the proposed code before applying. Nothing was applied.`,
          { status, code: SUGGESTION_TOO_LARGE_CODE }
        );
      if (bytes > MAX_APPLY_BODY_BYTES) throw tooLarge(null);
      return postJsonText('/api/apply-suggestion', text, async response => {
        if (response.status === 413) throw tooLarge(413);
        if (!response.ok) throw await requestError(response, 'POST /api/apply-suggestion', true);
        return response.json();
      });
    },

    submitReview: publishReview,
    publishReview,

    expandContext: (request: ExpandContextRequest) =>
      postJson<ExpandContextResponse | null>('/api/expand-context', request),

    loadFileContent: (filePath: string) =>
      getJson<DiffHunk[] | null>(withPath('/api/file', filePath)),

    loadImage: (filePath: string) => getJson<ImageLoadResult>(withPath('/api/image', filePath)),

    readAttachment: async (filePath: string): Promise<ArrayBuffer | null> => {
      // Bytes, not JSON: this route answers octet-stream, and 404 for an
      // attachment whose file is gone — which the image component renders
      // as "Image not found" rather than treating as an error.
      return requester.request(withPath('/api/attachment', filePath), {}, async response => {
        if (!response.ok) return null;
        return response.arrayBuffer();
      });
    },

    onGuideLoad: callback => subscribe(response => response.guide, callback),

    onDiffLoad: callback => subscribe(response => response.diff, callback),

    // changeOutputPath is deliberately absent — see the header comment.
  };
}
