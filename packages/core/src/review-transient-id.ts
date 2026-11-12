/** Compatibility IDs are transient and deliberately carry no document identity. */
export function createTransientReviewId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}
