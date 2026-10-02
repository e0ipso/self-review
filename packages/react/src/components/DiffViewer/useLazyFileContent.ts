import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiffFile } from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import { useAdapter } from '../../context/ReviewAdapterContext';

/** Only `idle` starts a request, so a failure stays until the reviewer retries. */
export type LazyLoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'error'; message: string };

const IDLE: LazyLoadState = { kind: 'idle' };

interface OwnedLoadState {
  file: DiffFile;
  sessionId: number;
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

function describeFailure(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'the request failed';
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
  const { updateFileHunks, sessionId } = useReview();
  const adapter = useAdapter();
  const [owned, setOwned] = useState<OwnedLoadState>({ file, sessionId, state: IDLE });
  const state = owned.file === file && owned.sessionId === sessionId ? owned.state : IDLE;

  // Bumped when an in-flight answer stops being wanted; a request applies it only if unchanged.
  const generationRef = useRef(0);
  useEffect(() => {
    return () => {
      generationRef.current += 1;
    };
  }, [file, sessionId]);

  const needsContent = expanded && file.contentLoaded === false;

  useEffect(() => {
    if (!needsContent || state.kind !== 'idle') return;
    const settle = (next: LazyLoadState) => setOwned({ file, sessionId, state: next });

    const loadFileContent = adapter?.loadFileContent;
    if (!loadFileContent) {
      settle({
        kind: 'error',
        message: 'this review host cannot load file content on demand',
      });
      return;
    }

    const generation = ++generationRef.current;
    const current = () => generation === generationRef.current;
    settle({ kind: 'loading' });

    loadFileContent(filePath).then(
      hunks => {
        if (!current()) return;
        if (hunks) {
          updateFileHunks(filePath, hunks);
          settle({ kind: 'loaded' });
        } else {
          settle({ kind: 'error', message: 'the review host returned no content for this file' });
        }
      },
      (error: unknown) => {
        if (!current()) return;
        settle({ kind: 'error', message: describeFailure(error) });
      }
    );
  }, [needsContent, state.kind, file, sessionId, filePath, adapter, updateFileHunks]);

  const retry = useCallback(() => {
    setOwned(prev =>
      prev.file === file && prev.sessionId === sessionId && prev.state.kind === 'error'
        ? { file, sessionId, state: IDLE }
        : prev
    );
  }, [file, sessionId]);

  return { state, retry };
}
