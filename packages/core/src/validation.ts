// Focused pure DTO policy for hosts that bundle validation independently of their runtime peer.
export { validateReviewState } from './review-state-validation';
export { decodeSuggestionApplyRequest, MAX_CONTEXT_LINES } from './review-request-validation';
export { ReviewXmlError } from './xml-errors';
export { sameDiffSource } from './same-diff-source';
