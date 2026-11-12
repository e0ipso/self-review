import React, { createContext, useContext, useMemo, useState } from 'react';

export interface ReviewShortcutPolicy {
  characterShortcuts: boolean;
  setCharacterShortcuts: (enabled: boolean) => void;
}
const ReviewShortcutContext = createContext<ReviewShortcutPolicy | null>(null);

/** In-memory preference owned by one review. It never changes the persisted AppConfig. */
export function ReviewShortcutProvider({
  children,
  initialCharacterShortcuts = true,
}: {
  children: React.ReactNode;
  initialCharacterShortcuts?: boolean;
}) {
  const [characterShortcuts, setCharacterShortcuts] = useState(initialCharacterShortcuts);
  const policy = useMemo(
    () => ({ characterShortcuts, setCharacterShortcuts }),
    [characterShortcuts]
  );
  return <ReviewShortcutContext.Provider value={policy}>{children}</ReviewShortcutContext.Provider>;
}

/** Null in old standalone compositions; their existing shortcuts stay enabled. */
export function useReviewShortcutPolicy() {
  return useContext(ReviewShortcutContext);
}
