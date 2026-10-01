import { useCallback, useEffect, useRef, useState } from 'react';
import type { DiffFile } from '@self-review/types';
import { useReview } from '../../context/ReviewContext';
import { useAdapter } from '../../context/ReviewAdapterContext';

/**
 * Where a file's on-demand content stands. Only `idle` starts a request, so a
 * failure stays put until the reviewer asks again.
 */
export type LazyLoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'loaded' }
  | { kind: 'error'; message: string };

const IDLE: LazyLoadState = { kind: 'idle' };

/** The load state together with the file and session it describes. */
interface OwnedLoadState {
  file: DiffFile;
  sessionId: number;
  state: LazyLoadState;
}

export interface UseLazyFileContentOptions {
  file: DiffFile;
  filePath: string;
  /** Only an expanded section asks for its content. */
  expanded: boolean;
}

export interface UseLazyFileContentResult {
  state: LazyLoadState;
  /** Ask again after a failure. Does nothing in any other state. */
  retry: () => void;
}

function describeFailure(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error) return error;
  return 'the request failed';
}

/**
 * Loads the hunks of a file the host sent without them (large-payload mode,
 * `contentLoaded: false`) when its section is expanded.
 *
 * - A request starts only from `idle`: one per expansion, never a loop. A
 *   rejection or an empty answer settles in `error` and stays there until
 *   {@link UseLazyFileContentResult.retry} is called.
 * - The state belongs to one file object in one session. When either is
 *   replaced (a new payload for the same path, a different review) the state
 *   reads as `idle` again, and any answer still in flight for the old one is
 *   dropped; so is one that arrives after the section unmounted.
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

  // Bumped whenever an answer in flight stops being wanted. A request
  // remembers the value it started under and applies its answer only if
  // nothing has bumped it since.
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
