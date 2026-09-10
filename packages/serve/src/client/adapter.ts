// A `ReviewAdapter` over `fetch`: transport only, since every component the
// browser renders already lives in `@self-review/react`.
//
// Three deliberate properties. `changeOutputPath` is absent, not stubbed —
// `FileTree` renders its control on the property's presence, so a stub would
// draw a dead button. `GET /api/diff` is issued once and shared, carrying both
// the diff and the guide, so there is no push transport. And `submitReview`
// resolving is acceptance, not a written file: lifecycle.ts writes on the
// response's `finish`, so nothing here may report a saved review.

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

/** Surfaces the server's `{ error }` text, since callers only log what they get. */
async function getJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(await errorText(response, `GET ${path}`));
  }
  return (await response.json()) as T;
}

/**
 * Post a JSON body. `content-type: application/json` is not optional: the
 * server answers 415 without it, on both POST routes.
 */
async function postJson<T>(path: string, body: unknown): Promise<T> {
  const response = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(await errorText(response, `POST ${path}`));
  }
  return (await response.json()) as T;
}

async function errorText(response: Response, what: string): Promise<string> {
  try {
    const body = (await response.json()) as { error?: unknown };
    if (typeof body?.error === 'string') {
      return `${what} failed (${response.status}): ${body.error}`;
    }
  } catch {
    // A non-JSON error body is no more informative than the status.
  }
  return `${what} failed (${response.status})`;
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
    binary += String.fromCharCode(
      ...bytes.subarray(offset, offset + BASE64_CHUNK_BYTES)
    );
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
        ...(comment.attachments
          ? { attachments: encodeAttachments(comment.attachments) }
          : {}),
        ...(comment.replies
          ? {
              replies: comment.replies.map(reply => ({
                ...reply,
                ...(reply.attachments
                  ? { attachments: encodeAttachments(reply.attachments) }
                  : {}),
              })),
            }
          : {}),
      })),
    })),
  };
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

    submitReview: async (state: ReviewState): Promise<void> => {
      // Resolving means the submission was *accepted*, not that the review
      // is on disk: the route only stores it on the session, and
      // ../lifecycle.ts writes the file on the response's finish event.
      await postJson<null>('/api/review', encodeReviewStateForWire(state));
    },

    expandContext: (request: ExpandContextRequest) =>
      postJson<ExpandContextResponse | null>('/api/expand-context', request),

    loadFileContent: (filePath: string) =>
      getJson<DiffHunk[] | null>(withPath('/api/file', filePath)),

    loadImage: (filePath: string) =>
      getJson<ImageLoadResult>(withPath('/api/image', filePath)),

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
