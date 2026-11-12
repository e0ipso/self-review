import type { RemoteBootstrapResult } from '../../packages/core/src/remote-mode';
import type { DiffLoadPayload, GuideLoadPayload, ResumeLoadPayload } from '../shared/types';
import type { RemoteLifetime } from './remote-lifetime';
import type { ReviewTransition } from './review-transition';
import { replaceReview } from './replacement-delivery';

export const REMOTE_OPEN_TIMEOUT_MS = 10 * 60_000;

interface RemoteOpeningDependencies {
  remote: Pick<RemoteLifetime, 'open' | 'cancelOwnedOpen' | 'ownsOpen' | 'closed'>;
  transition: Pick<ReviewTransition, 'begin'>;
  acquire: (url: string, signal: AbortSignal) => Promise<RemoteBootstrapResult>;
  loadGuide: (payload: DiffLoadPayload, signal: AbortSignal) => Promise<GuideLoadPayload | null>;
  adopt: (
    result: RemoteBootstrapResult,
    guide: GuideLoadPayload | null,
    resume: ResumeLoadPayload
  ) => void;
}

/** Owns acquisition through adoption, including confirmation and guide settlement. A cancelled
 * guide must settle before its remote is released; abort never detaches admitted work. */
export function createRemoteOpeningOperation(deps: RemoteOpeningDependencies) {
  return async (
    url: string,
    owner: {
      signal: AbortSignal;
      cancellation?: AbortController;
      assertCurrent: () => void;
      confirm: (payload: DiffLoadPayload) => Promise<boolean>;
      send: (channel: string, payload: unknown) => void;
    }
  ): Promise<boolean> => {
    const opening = deps.transition.begin();
    const abort = owner.cancellation ?? new AbortController();
    const signal = AbortSignal.any([owner.signal, abort.signal]);
    const deadline = setTimeout(
      () => abort.abort(new Error('opening the PR/MR took longer than 10 minutes')),
      REMOTE_OPEN_TIMEOUT_MS
    );
    let acquired: RemoteBootstrapResult | undefined;
    let adopted = false;
    const current = () => {
      owner.assertCurrent();
      opening.assertCurrent();
      signal.throwIfAborted();
      if (deps.remote.closed || (acquired && !deps.remote.ownsOpen(acquired)))
        throw new Error('Opening the PR/MR was cancelled.');
    };
    try {
      current();
      acquired = await deps.remote.open(
        controller => deps.acquire(url, AbortSignal.any([signal, controller.signal])),
        abort
      );
      current();
      if (!(await owner.confirm(acquired.payload))) return false;
      current();
      const guide = await deps.loadGuide(acquired.payload, signal);
      current();
      const resume: ResumeLoadPayload = {
        comments: acquired.session.fetchedComments,
        viewedFiles: [],
      };
      replaceReview({ payload: acquired.payload, guide, resume }, { ...owner, signal }, () => {
        current();
        deps.adopt(acquired!, guide, resume);
        adopted = true;
      });
      return true;
    } finally {
      clearTimeout(deadline);
      try {
        if (acquired && !adopted) await deps.remote.cancelOwnedOpen(acquired);
      } finally {
        opening.finish();
      }
    }
  };
}
export type RemoteOpeningOperation = ReturnType<typeof createRemoteOpeningOperation>;
