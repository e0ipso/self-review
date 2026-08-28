// src/serve-client/adapter.ts
// The serve-mode `ReviewAdapter`: the Electron adapter in `src/renderer/App.tsx`
// with `fetch` where that one has `window.electronAPI`.
//
// The two are deliberately kept line-for-line comparable — one method, one
// route, no layering — because the interface in
// `packages/react/src/adapter.ts` is the only thing holding the desktop and
// browser front ends together.
//
// Requests are same-origin relative paths: the server that answers `/api/*`
// is the server that served this bundle.
//
// Nothing here opens a stream and nothing polls: every remaining interaction
// is request/response, because the guide is resolved before the server listens
// and rides in the diff body. A push transport would have nothing to carry.

import type { ReviewAdapter } from '../../packages/react/src/adapter';
import type {
  DiffHunk,
  DiffLoadPayload,
  ExpandContextRequest,
  ExpandContextResponse,
  GuideLoadPayload,
  ImageLoadResult,
  ResumeLoadPayload,
  ReviewState,
} from '../shared/types';

/** `GET /api/diff` — the diff payload plus the guide, in one body. */
type DiffResponse = DiffLoadPayload & { guide?: GuideLoadPayload | null };

/** A path route's remainder is one encoded segment; the server decodes once. */
function pathRoute(prefix: string, filePath: string): string {
  return prefix + encodeURIComponent(filePath);
}

/**
 * An error naming the route and, when the body carries one, the server's own
 * `{ error }` message — the routes answer every refusal in that shape.
 */
async function failure(res: Response, action: string): Promise<Error> {
  let detail = `HTTP ${res.status}`;
  try {
    const body = (await res.json()) as { error?: string } | null;
    if (body && typeof body.error === 'string') detail = body.error;
  } catch {
    // A body that is not JSON tells us nothing the status has not already.
  }
  return new Error(`Failed to ${action}: ${detail}`);
}

/**
 * Build an adapter with its own guide subscribers.
 *
 * Exported for tests; the application uses the {@link httpAdapter} singleton
 * below, which is created once at module scope so the adapter's identity is
 * stable across renders.
 */
export function createHttpAdapter(): ReviewAdapter {
  // `onGuideLoad` keeps its subscribe/unsubscribe shape even though nothing
  // pushes: the guide arrives inside the diff response, so `loadDiff`
  // publishes it here. The last guide is retained and replayed to a later
  // subscriber, because a subscriber that mounts after the diff resolved
  // would otherwise never see one and the omission would be silent.
  const subscribers = new Set<(payload: GuideLoadPayload) => void>();
  let loadedGuide: GuideLoadPayload | null = null;

  return {
    // Loud on failure: the diff is the session, and `DiffLoadPayload` has no
    // shape to degrade into. ReviewContext catches and logs.
    loadDiff: async () => {
      const res = await fetch('/api/diff');
      if (!res.ok) throw await failure(res, 'load the diff');
      const { guide, ...payload } = (await res.json()) as DiffResponse;
      if (guide) {
        loadedGuide = guide;
        subscribers.forEach(callback => callback(guide));
      }
      return payload;
    },

    // The route answers 200 with a JSON `null` when there is nothing to
    // restore, which is not a failure — an empty payload restores nothing.
    // A non-2xx here is a broken route, so it throws like `loadDiff`.
    loadResumedReview: async () => {
      const res = await fetch('/api/resume');
      if (!res.ok) throw await failure(res, 'load the saved review');
      const payload = (await res.json()) as ResumeLoadPayload | null;
      return payload ?? { comments: [] };
    },

    // Throws on failure: the write is the point of the session, and the
    // finish control must not report success on a review that was not saved.
    submitReview: async (state: ReviewState) => {
      const res = await fetch('/api/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(state),
      });
      if (!res.ok) throw await failure(res, 'save the review');
    },

    // `null` is the interface's own "no expansion available", and is what the
    // handler returns for a non-git source. A refused path is the same answer.
    expandContext: async (request: ExpandContextRequest) => {
      const res = await fetch('/api/expand-context', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });
      if (!res.ok) return null;
      return (await res.json()) as ExpandContextResponse | null;
    },

    // Same reasoning as expandContext: the caller already handles `null` by
    // leaving the file collapsed.
    loadFileContent: async (filePath: string) => {
      const res = await fetch(pathRoute('/api/file/', filePath));
      if (!res.ok) return null;
      return (await res.json()) as DiffHunk[] | null;
    },

    // Never throws. A refusal is answered as `{ error }`, which is a valid
    // `ImageLoadResult` and exactly what the route sends on a 400 — and
    // RenderedImageView consumes this with `.then` and no `catch`, so a
    // rejection would leave a spinner running forever.
    loadImage: async (filePath: string): Promise<ImageLoadResult> => {
      try {
        const res = await fetch(pathRoute('/api/image/', filePath));
        return (await res.json()) as ImageLoadResult;
      } catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
      }
    },

    // The one route that is not JSON. `null` on a non-OK response is the
    // declared contract, and AttachmentImage renders "Image not found".
    readAttachment: async (filePath: string) => {
      const res = await fetch(pathRoute('/api/attachment/', filePath));
      if (!res.ok) return null;
      return res.arrayBuffer();
    },

    onGuideLoad: callback => {
      subscribers.add(callback);
      if (loadedGuide) callback(loadedGuide);
      return () => {
        subscribers.delete(callback);
      };
    },

    // `changeOutputPath` is absent on purpose: serve mode fixes the output
    // path at launch and there is no browser equivalent of the native save
    // dialog. FileTree guards on the method's absence, so omitting the key
    // removes the control; a stub that threw would offer one that fails.
  };
}

/** The adapter the serve-mode client uses. Created once, never per render. */
export const httpAdapter: ReviewAdapter = createHttpAdapter();
