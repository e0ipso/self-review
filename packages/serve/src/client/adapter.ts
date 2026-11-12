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
import type { ReviewAdapter } from '@self-review/react';
import type {
  AppConfig,
  DiffLoadPayload,
  ExpandContextRequest,
  OutputPathInfo,
  ResumeLoadPayload,
  ReviewState,
} from '@self-review/types';
import {
  MAX_REVIEW_BODY_BYTES,
  MAX_APPLY_BODY_BYTES,
  SUGGESTION_TOO_LARGE_CODE,
  REVIEW_TOO_LARGE_CODE,
  formatMegabytes,
} from '../protocol';

/** What `GET /api/config` answers. */
export interface ConfigApiResponse {
  config: AppConfig;
  outputPathInfo: OutputPathInfo | null;
}

import { ServeRequestError } from './request-error';
import { createServeRequester } from './requester';
export { ServeRequestError } from './request-error';

import { createClient, requestError } from './json-client';
import {
  decodeDiffResponse,
  decodeConfigResponse,
  decodeResumeResponse,
  decodeFileResponse,
  decodeContextResponse,
  decodeImageResponse,
  type DiffApiResponse,
} from './read-response';
import { encodeReviewStateForWire } from './review-codec';
import { decodeApplyResponse, decodePublicationResponse } from './mutation-response';
export { encodeReviewStateForWire } from './review-codec';

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
  return createClient(requester).getJson('/api/config', undefined, decodeConfigResponse);
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
  const reads = {
    expandContext: (request: ExpandContextRequest, signal?: AbortSignal) =>
      postJson('/api/expand-context', request, signal, decodeContextResponse),
    loadFileContent: (filePath: string, signal?: AbortSignal) =>
      getJson(withPath('/api/file', filePath), signal, decodeFileResponse),
    loadImage: (filePath: string, signal?: AbortSignal) =>
      getJson(withPath('/api/image', filePath), signal, decodeImageResponse),
    readAttachment: (filePath: string, signal?: AbortSignal): Promise<ArrayBuffer | null> =>
      requester.request(
        withPath('/api/attachment', filePath),
        { signal },
        async response => {
          if (response.status === 404) return null;
          if (!response.ok) throw await requestError(response, 'Read attachment');
          return response.arrayBuffer();
        },
        'read'
      ),
  };
  let diffRequest: Promise<DiffApiResponse> | null = null;
  let loaded: DiffApiResponse | null = null;
  let disposed = false;
  const subscriptions = new Set<(response: DiffApiResponse) => void>();

  function requestDiff(): Promise<DiffApiResponse> {
    if (diffRequest) return diffRequest;
    const request = getJson('/api/diff', undefined, decodeDiffResponse)
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
      return decodePublicationResponse(response);
    });
  };

  return {
    reads,
    dispose: () => {
      disposed = true;
      subscriptions.clear();
      requester.dispose();
    },
    loadDiff: async (): Promise<DiffLoadPayload> => (await requestDiff()).diff,

    loadResumedReview: async (): Promise<ResumeLoadPayload> =>
      // The route answers null when there is nothing to resume; an empty
      // payload says the same thing in the shape the interface promises.
      (await getJson('/api/resume', undefined, decodeResumeResponse)) ?? {
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
        return decodeApplyResponse(response, request);
      });
    },

    submitReview: publishReview,
    publishReview,

    expandContext: (request: ExpandContextRequest) => reads.expandContext(request),

    loadFileContent: (filePath: string) => reads.loadFileContent(filePath),

    loadImage: (filePath: string) => reads.loadImage(filePath),

    readAttachment: async (filePath: string): Promise<ArrayBuffer | null> => {
      // Bytes, not JSON: this route answers octet-stream, and 404 for an
      // attachment whose file is gone — which the image component renders
      // as "Image not found" rather than treating as an error.
      return reads.readAttachment(filePath);
    },

    onGuideLoad: callback => subscribe(response => response.guide, callback),

    onDiffLoad: callback => subscribe(response => response.diff, callback),

    // changeOutputPath is deliberately absent — see the header comment.
  };
}
