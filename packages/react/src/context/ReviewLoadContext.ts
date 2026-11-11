import { createContext, useContext } from 'react';

export interface ReviewLoadState {
  loadError: string | null;
  resumeError: string | null;
  retryLoad: () => Promise<void>;
  retryResume: () => Promise<void>;
}
export const ReviewLoadContext = createContext<ReviewLoadState | null>(null);
export function useReviewLoadState() {
  const state = useContext(ReviewLoadContext);
  if (!state) throw new Error('useReviewLoadState must be used within ReviewProvider');
  return state;
}
