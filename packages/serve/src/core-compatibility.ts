// Bundle canonical DTO policy while retaining installed-core error identity and selection.
import * as core from '@self-review/core';
import { ReviewXmlError } from '@self-review/core';
import {
  validateReviewState,
  ReviewXmlError as BundledXmlError,
} from '@self-review/core/validation';
import type { ReviewState } from '@self-review/core';

type ReviewStateValidator = (value: unknown) => ReviewState;

export function reviewStateValidatorFor(engine: {
  validateReviewState?: ReviewStateValidator;
}): ReviewStateValidator {
  return engine.validateReviewState ?? validateBundledReviewState;
}

function validateBundledReviewState(value: unknown): ReviewState {
  try {
    return validateReviewState(value);
  } catch (error) {
    // The bundled subpath has its own class in published serve. Keep callers'
    // instanceof checks tied to the installed root, in both ESM and CommonJS.
    if (error instanceof BundledXmlError) {
      throw new ReviewXmlError(error.code, error.message, {
        details: error.details,
        cause: error.cause,
      });
    }
    throw error;
  }
}

export const validateCompatibleReviewState = reviewStateValidatorFor(core);
