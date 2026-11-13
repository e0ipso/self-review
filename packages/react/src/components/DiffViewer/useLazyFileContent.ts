import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiffFile } from '@self-review/types';
import {
  useReviewCommands,
  useReviewSessionId,
  useReviewSnapshotId,
} from '../../context/ReviewContext';
import { useLocalization } from '../../localization/LocalizationContext';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { canReadFileContent, loadFileContent } from '../../read-service';

/** Only `idle` starts a request, so a failure stays until the reviewer retries. */
export type LazyLoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'error'; message: string };

const IDLE: LazyLoadState = { kind: 'idle' };

interface OwnedLoadState {
  owner: object;
  state: LazyLoadState;
}

export interface UseLazyFileContentOptions {
  file: DiffFile;
  filePath: string;
  expanded: boolean;
}

export interface UseLazyFileContentResult {
  state: LazyLoadState;
  retry: () => void;
}

function describeFailure(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return fallback;
}

/**
 * Loads the hunks of a file sent without them (`contentLoaded: false`) when its section expands.
 * A request starts only from `idle`; a rejection or empty answer settles in `error` until
 * `retry`. State belongs to one file object in one session: replacing either resets it to
 * `idle` and drops any answer in flight, as does unmounting.
 */
export function useLazyFileContent({
  file,
  filePath,
  expanded,
}: UseLazyFileContentOptions): UseLazyFileContentResult {
  const { t } = useLocalization();
  const { updateFileHunks } = useReviewCommands();
  const sessionId = useReviewSessionId();
  const snapshotId = useReviewSnapshotId();
  const adapter = useAdapter();
  const owner = useMemo(() => ({}), [file, sessionId, snapshotId, adapter, filePath]);
  const [owned, setOwned] = useState<OwnedLoadState>({ owner, state: IDLE });
  const state = owned.owner === owner ? owned.state : IDLE;
  const controllerRef = useRef<AbortController | null>(null);
  const needsContent = expanded && file.contentLoaded === false;

  // Bumped when an in-flight answer stops being wanted; a request applies it only if unchanged.
  const generationRef = useRef(0);
  useEffect(() => {
    return () => {
      generationRef.current += 1;
      controllerRef.current?.abort();
      controllerRef.current = null;
      setOwned(previous =>
        previous.owner === owner && previous.state.kind === 'loading'
          ? { owner, state: IDLE }
          : previous
      );
    };
  }, [owner, needsContent]);

  useEffect(() => {
    if (!needsContent || state.kind !== 'idle') return;
    const settle = (next: LazyLoadState) => setOwned({ owner, state: next });

    if (!canReadFileContent(adapter)) {
      settle({
        kind: 'error',
        message: t('this review host cannot load file content on demand'),
      });
      return;
    }

    const generation = ++generationRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const current = () => generation === generationRef.current && !controller.signal.aborted;
    settle({ kind: 'loading' });

    loadFileContent(adapter, filePath, controller.signal).then(
      hunks => {
        if (!current()) return;
        if (hunks) {
          updateFileHunks(filePath, hunks);
          settle({ kind: 'loaded' });
        } else {
          settle({
            kind: 'error',
            message: t('the review host returned no content for this file'),
          });
        }
      },
      (error: unknown) => {
        if (!current()) return;
        settle({ kind: 'error', message: describeFailure(error, t('the request failed')) });
      }
    );
  }, [needsContent, state.kind, owner, filePath, adapter, updateFileHunks, t]);

  const retry = useCallback(() => {
    setOwned(prev =>
      prev.owner === owner && prev.state.kind === 'error' ? { owner, state: IDLE } : prev
    );
  }, [owner]);

  return { state, retry };
}
