import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { useReviewSessionId, useReviewSnapshotId, useInteractionLock } from '@self-review/react';
import type { ReviewPanelHandle, ReviewSaveSnapshot, ReviewAdapter } from '@self-review/react';
import { ServeRequestError } from './request-error';

type Status = 'reviewing' | 'submitting' | 'submitted' | 'failed' | 'uncertain';
export interface SubmitFailure {
  code: string | null;
  uncertain?: boolean;
  message: string;
  details: readonly string[];
}
function failureOf(error: unknown): SubmitFailure {
  if (error instanceof ServeRequestError)
    return {
      code: error.code,
      message: error.message,
      details: error.details,
      uncertain: error.uncertain,
    };
  return {
    code: null,
    message: error instanceof Error ? error.message : String(error),
    details: [],
  };
}

/** Reports replacement from inside the provider without coupling the host to review data. */
export function SubmissionSession({ onChange }: { onChange: () => void }) {
  const session = useReviewSessionId();
  const snapshot = useReviewSnapshotId();
  useEffect(onChange, [onChange, session, snapshot]);
  return null;
}

/** Owns publication, immediate interaction exclusion, recovery and the tab-close guard. */
export function useReviewSubmission(
  review: RefObject<Pick<ReviewPanelHandle, 'beginSave'> | null>,
  adapter: Pick<ReviewAdapter, 'publishReview'> | null
) {
  const [status, setStatus] = useState<Status>('reviewing');
  const [failure, setFailure] = useState<SubmitFailure | null>(null);
  const [hasUnsavedWork, setHasUnsavedWork] = useState(false);
  const pending = useRef(false);
  const active = useRef<ReviewSaveSnapshot | null>(null);
  const live = useRef(true);
  const markUnsaved = useCallback(() => setHasUnsavedWork(true), []);
  const sessionChanged = useCallback(() => {
    if (!active.current || active.current.current()) return;
    active.current = null;
    pending.current = false;
    setStatus('reviewing');
    setFailure(null);
  }, []);
  useInteractionLock(pending);
  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      status === 'submitted' ||
      (!hasUnsavedWork && status !== 'submitting' && status !== 'uncertain')
    )
      return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [hasUnsavedWork, status]);

  const finish = useCallback(async () => {
    if (pending.current || status === 'submitted' || !adapter) return;
    let owner: ReviewSaveSnapshot;
    try {
      const begin = review.current?.beginSave;
      if (!begin) throw new Error('The review is not ready to save.');
      owner = begin();
    } catch (error) {
      setFailure(failureOf(error));
      setStatus('failed');
      return;
    }
    active.current = owner;
    pending.current = true;
    setStatus('submitting');
    setFailure(null);
    try {
      // The first-party HTTP adapter promises disk publication, never merely state handoff.
      if (!adapter.publishReview)
        throw Object.assign(new Error('Publication is unavailable.'), { uncertain: false });
      await adapter.publishReview(owner.state);
      if (!live.current || active.current !== owner || !owner.current()) return;
      pending.current = false;
      setStatus('submitted');
    } catch (error) {
      if (!live.current || active.current !== owner || !owner.current()) return;
      const known =
        typeof error === 'object' &&
        error !== null &&
        'uncertain' in error &&
        error.uncertain === false;
      if (known) {
        owner.unlock();
        active.current = null;
        pending.current = false;
      }
      setFailure({ ...failureOf(error), uncertain: !known });
      setStatus(known ? 'failed' : 'uncertain');
    }
  }, [adapter, review, status]);
  const allowRetry = useCallback(() => {
    if (
      status !== 'uncertain' ||
      !window.confirm(
        'Have you checked the terminal and output file and confirmed that this review was not saved? Only allow a retry if the original server is still running.'
      )
    )
      return;
    active.current?.unlock();
    active.current = null;
    pending.current = false;
    setStatus('reviewing');
    setFailure(null);
  }, [status]);
  return { status, failure, finish, allowRetry, markUnsaved, sessionChanged };
}
