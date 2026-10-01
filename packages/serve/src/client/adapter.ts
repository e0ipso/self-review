// A `ReviewAdapter` over `fetch`: transport only, since every component the
// browser renders already lives in `@self-review/react`.
//
// Four deliberate properties. `changeOutputPath` is absent, not stubbed —
// `FileTree` renders its control on the property's presence, so a stub would
// draw a dead button. `chooseApplyDestination` is absent for a stronger reason:
// the UI only asks for a destination when the session is a temporary remote
// clone, and serve mode has no remote mode, so the case cannot arise.
// `GET /api/diff` is issued once and shared, carrying both the diff and the
// guide, so there is no push transport. And `submitReview` resolving means
// the review is on disk: the route publishes before it answers, and a 200
// without that acknowledgement is treated as a failure rather than a save.

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
import { MAX_REVIEW_BODY_BYTES, REVIEW_TOO_LARGE_CODE, formatMegabytes } from '../protocol';
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

/**
 * A request the server refused, or one this adapter refused to send. The
 * message is what the page shows; the code is what it acts on.
 */
export class ServeRequestError extends Error {
  /** The HTTP status of the refusal, or null when the request was never sent. */
  readonly status: number | null;
  /**
   * The publisher's `ReviewPublishError.code` when the server sent one,
   * `REVIEW_TOO_LARGE_CODE` for a body over the limit, otherwise null.
   */
  readonly code: string | null;
  /** One rendered line per individual problem, when the server listed them. */
  readonly details: readonly string[];

  constructor(
    message: string,
    options: { status: number | null; code?: string | null; details?: readonly string[] }
  ) {
    super(message);
    this.name = 'ServeRequestError';
    this.status = options.status;
    this.code = options.code ?? null;
    this.details = options.details ?? [];
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read the server's refusal into an error. Two shapes exist: the publisher's
 * `{ ok: false, code, message, details }`, whose message stands on its own,
 * and the validation routes' `{ error }`, which is prefixed with the request
 * it answers since callers only log what they get.
 */
async function requestError(response: Response, what: string): Promise<ServeRequestError> {
  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON error body is no more informative than the status.
  }
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
      });
    }
  }
  return new ServeRequestError(`${what} failed (${response.status})`, {
    status: response.status,
  });
}

async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw await requestError(response, `GET ${path}`);
  }
  return (await response.json()) as T;
}

/**
 * Post an already-serialized JSON body. `content-type: application/json` is
 * not optional: the server answers 415 without it, on every POST route.
 */
function postJsonText(path: string, text: string): Promise<Response> {
  return fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: text,
  });
}

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await postJsonText(path, JSON.stringify(body));
  if (!response.ok) {
    throw await requestError(response, `POST ${path}`);
  }
  return (await response.json()) as T;
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

// ---------------------------------------------------------------------------
// The body limit.
//
// The server caps `POST /api/review` at MAX_REVIEW_BODY_BYTES and closes the
// connection on anything over it. Attachments are base64-encoded on the wire,
// so a review can be over the limit as sent while well under it on disk —
// a reviewer cannot see that coming, and the server's 413 arrives after the
// socket has been closed on the body. So the size is measured here, before
// anything is sent, and both refusals carry the same message: what the
// review weighs, what the limit is, and what to do about it.
// ---------------------------------------------------------------------------

function tooLarge(bytes: number, status: number | null): ServeRequestError {
  return new ServeRequestError(
    `This review is ${formatMegabytes(bytes)} MB as sent, over the server's ` +
      `${formatMegabytes(MAX_REVIEW_BODY_BYTES)} MB limit. Image attachments are the usual ` +
      'cause — they are base64-encoded on the wire, which adds a third — so remove or shrink ' +
      'some and press Finish Review again. Nothing has been lost.',
    { status, code: REVIEW_TOO_LARGE_CODE }
  );
}

/** The byte length of a string as UTF-8, which is what the server counts. */
function byteLength(text: string): number {
  return new Blob([text]).size;
}

/** Path-bearing routes take the path as a query parameter, encoded once. */
function withPath(route: string, filePath: string): string {
  return `${route}?path=${encodeURIComponent(filePath)}`;
}

/** Read the config and its output path info. Fetched before the UI mounts. */
export async function loadServeConfig(): Promise<ConfigApiResponse | null> {
  return getJson<ConfigApiResponse | null>('/api/config');
}

/**
 * Build the adapter for one page load.
 *
 * A factory rather than a module-level object because the shared
 * `GET /api/diff` promise is per-session state; a test gets a fresh one per
 * case, and the page creates exactly one.
 */
export function createFetchAdapter(): ReviewAdapter {
  let diffRequest: Promise<DiffApiResponse> | null = null;

  /** The one `GET /api/diff`, shared by loadDiff and both subscriptions. */
  function requestDiff(): Promise<DiffApiResponse> {
    diffRequest ??= getJson<DiffApiResponse | null>('/api/diff').then(response => {
      if (response === null) {
        throw new Error('The server has no diff to review');
      }
      return response;
    });
    return diffRequest;
  }

  /**
   * Deliver one half of the shared diff response to a subscriber. Returns
   * the unsubscribe function the interface requires — the subscribing effect
   * re-runs whenever the adapter identity changes, and a late delivery to a
   * torn-down consumer would be a state update after unmount.
   */
  function subscribe<T>(
    select: (response: DiffApiResponse) => T | null,
    callback: (value: T) => void
  ): () => void {
    let active = true;
    void requestDiff()
      .then(response => {
        const value = select(response);
        if (active && value !== null) callback(value);
      })
      .catch(() => {
        // loadDiff surfaces the failure; a subscriber has nothing to add.
      });
    return () => {
      active = false;
    };
  }

  return {
    loadDiff: async (): Promise<DiffLoadPayload> => (await requestDiff()).diff,

    loadResumedReview: async (): Promise<ResumeLoadPayload> =>
      // The route answers null when there is nothing to resume; an empty
      // payload says the same thing in the shape the interface promises.
      (await getJson<ResumeLoadPayload | null>('/api/resume')) ?? {
        comments: [],
        viewedFiles: [],
      },

    applySuggestion: request => postJson('/api/apply-suggestion', request),

    /**
     * Resolves once the review is on disk. The route publishes the document
     * before it answers, so the 200 is the acknowledgement; every refusal is
     * a `ServeRequestError` whose message says what to fix, and the review
     * stays in the page for the retry.
     */
    submitReview: async (state: ReviewState): Promise<void> => {
      const text = JSON.stringify(encodeReviewStateForWire(state));
      const bytes = byteLength(text);
      if (bytes > MAX_REVIEW_BODY_BYTES) {
        throw tooLarge(bytes, null);
      }
      const response = await postJsonText('/api/review', text);
      if (response.status === 413) {
        throw tooLarge(bytes, response.status);
      }
      if (!response.ok) {
        throw await requestError(response, 'POST /api/review');
      }
      const ack = (await response.json()) as ReviewSubmitAck | null;
      if (!isRecord(ack) || ack.ok !== true) {
        throw new ServeRequestError(
          'The server answered without acknowledging the review as written. ' +
            'Check the terminal it was started from, then press Finish Review again.',
          { status: response.status }
        );
      }
    },

    expandContext: (request: ExpandContextRequest) =>
      postJson<ExpandContextResponse | null>('/api/expand-context', request),

    loadFileContent: (filePath: string) =>
      getJson<DiffHunk[] | null>(withPath('/api/file', filePath)),

    loadImage: (filePath: string) => getJson<ImageLoadResult>(withPath('/api/image', filePath)),

    readAttachment: async (filePath: string): Promise<ArrayBuffer | null> => {
      // Bytes, not JSON: this route answers octet-stream, and 404 for an
      // attachment whose file is gone — which the image component renders
      // as "Image not found" rather than treating as an error.
      const response = await fetch(withPath('/api/attachment', filePath));
      if (!response.ok) return null;
      return response.arrayBuffer();
    },

    onGuideLoad: callback => subscribe(response => response.guide, callback),

    onDiffLoad: callback => subscribe(response => response.diff, callback),

    // changeOutputPath is deliberately absent — see the header comment.
  };
}
