// API handlers bind only their own engine capabilities. Admission is mandatory at registration.
import type * as http from 'node:http';
import { parseAttachmentReference } from '@self-review/core';
import { parseExpandContextBody, parseReviewStateBody, parseSuggestionApplyBody } from './validate';
import { MAX_REVIEW_BODY_BYTES, MAX_APPLY_BODY_BYTES } from './protocol';
import { readJsonBody, sendJson, sendError, SECURITY_HEADERS } from './http-transport';
import type { ReviewOperations } from './review-operations';
import { ReviewSubmission, publishFailureStatus } from './review-submission';
import type { RequestKind } from './request-admission';

export const MAX_EXPAND_CONTEXT_BODY_BYTES = 64 * 1024;
export interface RouteContext {
  req: http.IncomingMessage;
  res: http.ServerResponse;
  url: URL;
  signal: AbortSignal;
}

export type RouteHandler = (ctx: RouteContext) => Promise<void>;

const REVIEWED_PATH_ERROR = 'path must name a file in the reviewed diff';

/** Core's authorization; answers 400 and returns false when `filePath` is not a reviewed path. */
function requireReviewedPath(
  ctx: RouteContext,
  authorize: ReviewOperations['authorizeReviewedPath'],
  filePath: string,
  what = 'path'
): boolean {
  if (authorize(filePath).ok) return true;
  sendError(
    ctx.res,
    400,
    what === 'path' ? REVIEWED_PATH_ERROR : `${what} must name a file in the reviewed diff`
  );
  return false;
}

function requireReviewedQueryPath(
  ctx: RouteContext,
  authorize: ReviewOperations['authorizeReviewedPath']
): string | null {
  const raw = ctx.url.searchParams.get('path');
  if (raw === null) {
    sendError(ctx.res, 400, REVIEWED_PATH_ERROR);
    return null;
  }
  return requireReviewedPath(ctx, authorize, raw) ? raw : null;
}

function createFileRoute({
  authorizeReviewedPath,
  getFileHunks,
}: Pick<ReviewOperations, 'authorizeReviewedPath' | 'getFileHunks'>): RouteHandler {
  return async ctx => {
    const filePath = requireReviewedQueryPath(ctx, authorizeReviewedPath);
    if (filePath === null) return;
    // Diff paths are source-relative strings; core matches on them as sent.
    sendJson(ctx.res, 200, getFileHunks(filePath));
  };
}

function createImageRoute({
  authorizeReviewedPath,
  loadImage,
}: Pick<ReviewOperations, 'authorizeReviewedPath' | 'loadImage'>): RouteHandler {
  return async ctx => {
    const filePath = requireReviewedQueryPath(ctx, authorizeReviewedPath);
    if (filePath === null) return;
    // Core reads the reviewed snapshot under the same identity it just authorized.
    sendJson(ctx.res, 200, await loadImage(filePath, { signal: ctx.signal }));
  };
}

function createAttachmentRoute({
  readAttachment,
}: Pick<ReviewOperations, 'readAttachment'>): RouteHandler {
  return async ctx => {
    // Not a diff path: a `.self-review-assets/<name>` reference core resolves itself; only its shape is checked here.
    const raw = ctx.url.searchParams.get('path');
    if (raw === null || parseAttachmentReference(raw) === null) {
      sendError(ctx.res, 400, 'path must name a file in the .self-review-assets directory');
      return;
    }
    const result = await readAttachment(raw, { signal: ctx.signal });
    if (!result.ok) {
      const status =
        result.reason === 'not-authorized' ? 400 : result.reason === 'too-large' ? 413 : 404;
      sendError(ctx.res, status, status === 404 ? 'attachment not found' : result.message);
      return;
    }
    const { res } = ctx;
    res.writeHead(200, {
      'content-type': 'application/octet-stream',
      'cache-control': 'no-store',
      ...SECURITY_HEADERS,
    });
    res.end(Buffer.from(result.data));
  };
}

function createExpansionRoute({
  authorizeReviewedPath,
  expandContext,
}: Pick<ReviewOperations, 'authorizeReviewedPath' | 'expandContext'>): RouteHandler {
  return async ctx => {
    const { req, res } = ctx;
    const body = await readJsonBody(req, MAX_EXPAND_CONTEXT_BODY_BYTES, ctx.signal);
    if (!body.ok) {
      sendError(res, body.status, body.error);
      return;
    }
    const parsed = parseExpandContextBody(body.value);
    if (!parsed.ok) {
      sendError(res, 400, parsed.error);
      return;
    }
    // Becomes a git pathspec; authorized as a reviewed path, then passed through as sent.
    if (!requireReviewedPath(ctx, authorizeReviewedPath, parsed.value.filePath, 'filePath')) return;
    sendJson(res, 200, await expandContext(parsed.value, { signal: ctx.signal }));
  };
}

function createApplyRoute({
  authorizeReviewedPath,
  applySuggestionForSession,
}: Pick<ReviewOperations, 'authorizeReviewedPath' | 'applySuggestionForSession'>): RouteHandler {
  return async ctx => {
    const { req, res } = ctx;
    const body = await readJsonBody(req, MAX_APPLY_BODY_BYTES, ctx.signal);
    if (!body.ok) {
      sendError(res, body.status, body.error);
      return;
    }
    const parsed = parseSuggestionApplyBody(body.value);
    if (!parsed.ok) {
      sendError(res, 400, parsed.error);
      return;
    }
    if (!requireReviewedPath(ctx, authorizeReviewedPath, parsed.value.filePath, 'filePath')) return;
    sendJson(res, 200, await applySuggestionForSession(parsed.value, { signal: ctx.signal }));
  };
}

function createSubmissionRoute(
  submission: Pick<ReviewSubmission, 'begin' | 'publish' | 'release'>,
  published: (response: http.ServerResponse) => void
): RouteHandler {
  return async ({ req, res, signal }) => {
    if (!submission.begin()) {
      sendError(res, 409, 'review submission already in progress or complete');
      return;
    }
    try {
      const body = await readJsonBody(req, MAX_REVIEW_BODY_BYTES, signal);
      if (!body.ok) {
        sendError(res, body.status, body.error);
        return;
      }
      const parsed = parseReviewStateBody(body.value);
      if (!parsed.ok) {
        sendError(res, 400, parsed.error);
        return;
      }
      if (signal.aborted) throw signal.reason;
      const outcome = await submission.publish(parsed.value, { signal });
      if (outcome.ok) {
        published(res);
        sendJson(res, 200, outcome);
      } else {
        sendJson(res, publishFailureStatus(outcome.code), outcome);
      }
    } finally {
      submission.release();
    }
  };
}
export interface ApiRoute {
  kind: RequestKind;
  handle: RouteHandler;
}

/** Composition is the only place with access to the full operation bundle. */
export function createApiRoutes(
  operations: ReviewOperations,
  submission: ReviewSubmission,
  published: (response: http.ServerResponse) => void
): Record<string, ApiRoute> {
  // Keep operation replacement observable for hosts using the existing injected test seam.
  const getDiffLoad = () => operations.getDiffLoad();
  const getConfigLoad = () => operations.getConfigLoad();
  const getResumeLoad = () => operations.getResumeLoad();
  const authorizeReviewedPath: ReviewOperations['authorizeReviewedPath'] = path =>
    operations.authorizeReviewedPath(path);
  return {
    'GET /api/diff': {
      kind: 'read',
      handle: async ({ res }) => {
        sendJson(res, 200, getDiffLoad());
      },
    },
    'GET /api/config': {
      kind: 'read',
      handle: async ({ res }) => {
        sendJson(res, 200, getConfigLoad());
      },
    },
    'GET /api/resume': {
      kind: 'read',
      handle: async ({ res }) => {
        sendJson(res, 200, getResumeLoad());
      },
    },
    'GET /api/file': {
      kind: 'read',
      handle: createFileRoute({
        authorizeReviewedPath,
        getFileHunks: (...args) => operations.getFileHunks(...args),
      }),
    },
    'GET /api/image': {
      kind: 'expensive-read',
      handle: createImageRoute({
        authorizeReviewedPath,
        loadImage: (...args) => operations.loadImage(...args),
      }),
    },
    'GET /api/attachment': {
      kind: 'expensive-read',
      handle: createAttachmentRoute({
        readAttachment: (...args) => operations.readAttachment(...args),
      }),
    },
    'POST /api/expand-context': {
      kind: 'mutation',
      handle: createExpansionRoute({
        authorizeReviewedPath,
        expandContext: (...args) => operations.expandContext(...args),
      }),
    },
    'POST /api/apply-suggestion': {
      kind: 'mutation',
      handle: createApplyRoute({
        authorizeReviewedPath,
        applySuggestionForSession: (...args) => operations.applySuggestionForSession(...args),
      }),
    },
    'POST /api/review': {
      kind: 'publication',
      handle: createSubmissionRoute(submission, published),
    },
  };
}
