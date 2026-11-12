import { randomUUID } from 'crypto';
import type { ReviewSaveResult } from '../shared/types';

/** In-memory outcomes belong to the requesting window. Tokens are consumed once, never replayed. */
export class PublicationReceipts {
  private receipt: { token: string; current: () => void } | null = null;
  private failed: { result: ReviewSaveResult; current: () => void } | null = null;

  clearFailure(): void {
    this.failed = null;
  }
  recordFailure(result: ReviewSaveResult, current: () => void): ReviewSaveResult {
    this.failed = { result, current };
    return result;
  }
  saved(current: () => void): ReviewSaveResult {
    this.receipt = { token: randomUUID(), current };
    return { status: 'saved', receipt: this.receipt.token };
  }
  inspect(): ReviewSaveResult | null {
    if (this.receipt) {
      this.receipt.current();
      return { status: 'saved', receipt: this.receipt.token };
    }
    if (!this.failed) return null;
    this.failed.current();
    return this.failed.result;
  }
  acknowledge(token: string): void {
    if (!this.receipt || token !== this.receipt.token)
      throw new Error('Unknown publication receipt.');
    this.receipt.current();
    this.receipt = null;
  }
}
