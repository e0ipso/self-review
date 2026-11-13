import React, { useContext, useMemo, useSyncExternalStore } from 'react';
import { ReviewContext, SessionStoreContext } from './review-context';
import type { ReviewSessionStore } from './review-session';
import {
  getViewedReviewIndex,
  indexViewedFiles,
  type ViewedReviewIndex,
} from './review-viewed-index';

interface ViewedReviewProps {
  match: keyof ViewedReviewIndex;
  children: (paths: ReadonlySet<string>) => React.ReactNode;
}

/** Guide progress subscribes only to viewed paths. The legacy context-only composition remains
 * supported without subscribing store-backed consumers to the complete review projection.
 */
export function ViewedReview(props: ViewedReviewProps) {
  const store = useContext(SessionStoreContext);
  return store ? (
    <IndexedViewedReview {...props} store={store} />
  ) : (
    <LegacyViewedReview {...props} />
  );
}

function IndexedViewedReview({
  store,
  match,
  children,
}: ViewedReviewProps & { store: ReviewSessionStore }) {
  const read = () => getViewedReviewIndex(store)[match];
  const paths = useSyncExternalStore(store.subscribe, read, read);
  return children(paths);
}

function LegacyViewedReview({ match, children }: ViewedReviewProps) {
  const review = useContext(ReviewContext);
  if (!review) throw new Error('useReview must be used within ReviewProvider');
  const { files } = review;
  const viewed = useMemo(() => indexViewedFiles(files), [files]);
  return children(viewed[match]);
}
