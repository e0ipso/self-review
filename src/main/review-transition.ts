import type { ReviewSession } from '../../packages/core/src/review-handlers';

/** Serializes welcome-screen starts. An async continuation may commit only to its original welcome. */
export class ReviewTransition {
  private pending = false;
  constructor(private readonly session: Pick<ReviewSession, 'diffData'>) {}

  capture(): () => void {
    const original = this.session.diffData;
    if (original?.source.type !== 'welcome') throw new Error('A review is already open.');
    return () => {
      if (this.session.diffData !== original) throw new Error('The review session has changed.');
    };
  }

  begin(): { assertCurrent: () => void; finish: () => void } {
    const assertCurrent = this.capture();
    if (this.pending) throw new Error('A review is already being opened.');
    this.pending = true;
    return {
      assertCurrent,
      finish: () => {
        this.pending = false;
      },
    };
  }
}
