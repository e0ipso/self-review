import { createContext, useContext, useState, useSyncExternalStore } from 'react';
import type { SuggestionApplyOutcome } from '@self-review/types';

/** Presentation state is deliberately separate from the engine's closed outcome DTO. */
export interface ApplyOperation {
  pending: boolean;
  outcome: SuggestionApplyOutcome | null;
  unknown: boolean;
}
const IDLE: ApplyOperation = { pending: false, outcome: null, unknown: false };
export function createApplyOperations() {
  const states = new Map<string, ApplyOperation>();
  const listeners = new Set<() => void>();
  return {
    read: (key: string) => states.get(key) ?? IDLE,
    write: (key: string, state: ApplyOperation) => {
      states.set(key, state);
      listeners.forEach(listener => listener());
    },
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export const ApplyOperationsContext = createContext<ReturnType<
  typeof createApplyOperations
> | null>(null);

/** The provider owns pending and unknown results even while a comment is collapsed.
 * Without a review provider the standalone control owns its own lifetime.
 */
export function useApplyOperation(key: string) {
  const session = useContext(ApplyOperationsContext);
  const [local] = useState(createApplyOperations);
  const store = session ?? local;
  const state = useSyncExternalStore(
    store.subscribe,
    () => store.read(key),
    () => store.read(key)
  );
  return {
    state,
    read: () => store.read(key),
    write: (next: ApplyOperation) => store.write(key, next),
  };
}
