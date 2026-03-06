import React, { createContext, useContext, ReactNode } from 'react';
import type { ReviewAdapter } from '../adapter';

const ReviewAdapterContext = createContext<ReviewAdapter | null>(null);

export interface ReviewAdapterProviderProps {
  adapter: ReviewAdapter;
  children: ReactNode;
}

export function ReviewAdapterProvider({ adapter, children }: ReviewAdapterProviderProps) {
  return (
    <ReviewAdapterContext.Provider value={adapter}>
      {children}
    </ReviewAdapterContext.Provider>
  );
}

export function useAdapter(): ReviewAdapter | null {
  return useContext(ReviewAdapterContext);
}
