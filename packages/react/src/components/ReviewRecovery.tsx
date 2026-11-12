import React from 'react';
import { ReviewLoadRecovery } from './ReviewLoadRecovery';
import { ReviewDraftRecovery } from './Comments/ReviewDraftRecovery';

/** Default recovery presentation. Custom compositions can place either control independently. */
export function ReviewRecovery() {
  return (
    <>
      <ReviewLoadRecovery />
      <ReviewDraftRecovery />
    </>
  );
}
