import React, { createContext, useContext, useMemo, type ReactNode } from 'react';

/** Review metadata only. Never use these services for credentials, capabilities or asset names. */
export interface ReviewServices {
  createId: () => string;
  now: () => Date;
}

const browserServices: ReviewServices = {
  createId: () => crypto.randomUUID(),
  now: () => new Date(),
};
const ReviewServicesContext = createContext<ReviewServices>(browserServices);

/** Scoped dependencies for comments and review timestamps. Missing services inherit browser defaults. */
export function ReviewServicesProvider({
  services,
  children,
}: {
  services?: Partial<ReviewServices>;
  children: ReactNode;
}) {
  const inherited = useReviewServices();
  const createId = services?.createId ?? inherited.createId;
  const now = services?.now ?? inherited.now;
  const value = useMemo(() => ({ createId, now }), [createId, now]);
  return <ReviewServicesContext.Provider value={value}>{children}</ReviewServicesContext.Provider>;
}

export function useReviewServices(): ReviewServices {
  return useContext(ReviewServicesContext);
}
