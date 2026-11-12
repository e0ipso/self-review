import { useContext, useSyncExternalStore } from 'react';
import type { ReviewSessionStore } from './review-session';
import { SessionStoreContext, CommandsContext } from './review-context';

export function useReviewCommands() {
  const commands = useContext(CommandsContext);
  if (!commands) throw new Error('useReviewCommands must be used within ReviewProvider');
  return commands;
}

export function useOptionalSnapshotKey() {
  const store = useContext(SessionStoreContext);
  const read = () =>
    store ? `${store.getSnapshot().sessionId}:${store.getSnapshot().snapshotId}` : '';
  return useSyncExternalStore(store?.subscribe ?? (() => () => {}), read, read);
}

/** Apply controls depend on session ownership and destination, never on comment bodies. */
export function useOptionalApplySession() {
  const store = useContext(SessionStoreContext);
  const commands = useContext(CommandsContext);
  const subscribe = store?.subscribe ?? emptySubscribe;
  const read = () => store?.getSnapshot();
  // Each selected value retains its identity across unrelated file/comment updates.
  const select =
    <T>(selector: (state: ReturnType<ReviewSessionStore['getSnapshot']>) => T) =>
    () => {
      const state = read();
      return state ? selector(state) : undefined;
    };
  const sessionId = useSyncExternalStore(
    subscribe,
    select(s => s.sessionId),
    select(s => s.sessionId)
  );
  const snapshotId = useSyncExternalStore(
    subscribe,
    select(s => s.snapshotId),
    select(s => s.snapshotId)
  );
  const diffSource = useSyncExternalStore(
    subscribe,
    select(s => s.diffSource),
    select(s => s.diffSource)
  );
  const reviewedPaths = useSyncExternalStore(
    subscribe,
    select(s => s.reviewedPaths),
    select(s => s.reviewedPaths)
  );
  const remote = useSyncExternalStore(
    subscribe,
    select(s => s.remote),
    select(s => s.remote)
  );
  const applyDestination = useSyncExternalStore(
    subscribe,
    select(s => s.applyDestination),
    select(s => s.applyDestination)
  );
  return store && commands && diffSource && reviewedPaths
    ? {
        sessionId,
        snapshotId,
        diffSource,
        reviewedPaths,
        remote,
        applyDestination,
        isCurrentSession: commands.isCurrentSession,
        setApplyDestination: commands.setApplyDestination,
      }
    : null;
}
const emptySubscribe = () => () => {};
