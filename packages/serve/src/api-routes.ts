// Original route facade; default engine selection stays at composition.
import type * as http from 'node:http';
import type { ReviewTransportOperations } from './review-operations';
import type { ReviewSubmission } from './review-submission';
import type { RequestValidation } from './validate';
import { createBoundApiRoutes } from './bound-api-routes';
import { bindRouteValidation } from './route-composition';
export { MAX_EXPAND_CONTEXT_BODY_BYTES } from './bound-api-routes';
export type { RouteContext, RouteHandler, ApiRoute } from './bound-api-routes';

export function createApiRoutes(
  operations: ReviewTransportOperations,
  submission: ReviewSubmission,
  published: (response: http.ServerResponse) => void,
  validation: RequestValidation | undefined = undefined
) {
  return createBoundApiRoutes(
    operations,
    submission,
    published,
    bindRouteValidation(operations, validation)
  );
}
