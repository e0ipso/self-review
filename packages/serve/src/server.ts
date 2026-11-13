// Existing convenience facade. New hosts compose operations before transport.
import type {
  ReviewOutputTarget as CoreReviewOutputTarget,
  ReviewSession,
} from '@self-review/core';
import { createReviewOperations, type ReviewOperations } from './review-operations';
import { legacyPublication } from './legacy-submission';
import { createBoundReviewServer, type ReviewTransportOptions } from './bound-server';
import type { ManagedReviewServer } from './request-admission';
export {
  defaultClientDir,
  listenLoopback,
  MAX_REVIEW_BODY_BYTES,
  MAX_EXPAND_CONTEXT_BODY_BYTES,
  createBoundReviewServer,
} from './bound-server';
export type { PublicationReviewServerOptions } from './bound-server';

export type ReviewOutputTarget = CoreReviewOutputTarget;
export interface BoundReviewServerOptions extends ReviewTransportOptions {
  operations: ReviewOperations;
}
export interface ReviewServerOptions extends ReviewTransportOptions {
  session: ReviewSession;
  output: ReviewOutputTarget;
  operations?: ReviewOperations;
}

export function createReviewServer(options: BoundReviewServerOptions): ManagedReviewServer;
export function createReviewServer(options: ReviewServerOptions): ManagedReviewServer;
export function createReviewServer(
  options: BoundReviewServerOptions | ReviewServerOptions
): ManagedReviewServer {
  const operations =
    options.operations ??
    createReviewOperations(
      (options as ReviewServerOptions).session,
      (options as ReviewServerOptions).output
    );
  return createBoundReviewServer({
    ...options,
    operations,
    publication: legacyPublication(operations),
  });
}
