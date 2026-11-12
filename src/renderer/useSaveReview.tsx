import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import {
  UnfinishedReviewDraftError,
  useReviewSaveTransaction,
  useReviewSessionId,
  useReviewSnapshotId,
} from '../../packages/react/src';
import type { ElectronAPI } from '../shared/types';
import { Button } from '../../packages/react/src/components/ui/button';
import { useDesktopLocalization } from './useDesktopLocalization';
import {
  createDesktopPublicationClient,
  DesktopPublicationError,
} from './desktop-publication-client';
import { useInteractionLock } from './useInteractionLock';

type SaveAPI = Pick<
  ElectronAPI,
  | 'submitReview'
  | 'saveAndQuit'
  | 'saveReview'
  | 'acknowledgeReviewSave'
  | 'onSaveFailed'
  | 'getSaveResult'
> &
  Partial<Pick<ElectronAPI, 'discardAndQuit' | 'handoffReview'>>;
type SaveState = 'reviewing' | 'saving' | 'unknown';
interface SaveControl {
  save: () => void;
  status: SaveState;
  detail: string | null;
  check: (() => void) | undefined;
}
const SaveContext = createContext<SaveControl | null>(null);

function useOwnedSave(api: SaveAPI, enabled = true): SaveControl {
  const { t } = useDesktopLocalization();
  const transaction = useReviewSaveTransaction();
  const [status, setStatus] = useState<SaveState>('reviewing');
  const [detail, setDetail] = useState<string | null>(null);
  const pending = useRef(false);
  const active = useRef<ReturnType<typeof transaction.begin> | null>(null);
  const session = useReviewSessionId();
  const snapshot = useReviewSnapshotId();
  const protocol = useRef<{
    api: SaveAPI;
    client: ReturnType<typeof createDesktopPublicationClient>;
  } | null>(null);
  useInteractionLock(pending, enabled);

  useLayoutEffect(() => {
    if (!enabled) return;
    const client = createDesktopPublicationClient(api);
    protocol.current = { api, client };
    // An API replacement cannot release a snapshot whose write may already have committed.
    if (pending.current) setStatus('unknown');
    return () => {
      client.dispose();
      if (protocol.current?.client === client) protocol.current = null;
    };
  }, [api, enabled]);
  useLayoutEffect(() => {
    if (!enabled) return;
    protocol.current?.client.stopWaiting();
    pending.current = false;
    active.current = null;
    setStatus('reviewing');
    setDetail(null);
  }, [enabled, session, snapshot]);
  useLayoutEffect(() => {
    if (!enabled) return;
    const client = protocol.current?.client;
    return api.onSaveFailed?.(() => {
      const owner = active.current;
      if (protocol.current?.client !== client || !owner?.current()) return;
      active.current = null;
      client?.stopWaiting();
      owner.unlock();
      pending.current = false;
      setStatus('reviewing');
      setDetail(null);
    });
  }, [api, enabled]);

  const settleFailure = useCallback(
    (
      error: unknown,
      owner: ReturnType<typeof transaction.begin>,
      client: ReturnType<typeof createDesktopPublicationClient>
    ) => {
      if (protocol.current?.client !== client || active.current !== owner || !owner.current())
        return;
      if (error instanceof DesktopPublicationError && !error.uncertain) {
        active.current = null;
        client.stopWaiting();
        owner.unlock();
        pending.current = false;
        setStatus('reviewing');
      } else {
        setStatus('unknown');
      }
      if (error instanceof DesktopPublicationError) {
        if (error.handoff)
          setDetail(
            t('The host could not accept the review state. {detail}', { detail: error.message })
          );
        else if (!error.uncertain) setDetail([error.message, ...error.details].join('\n\n'));
      }
    },
    [t]
  );

  const save = useCallback(() => {
    const client = protocol.current?.client;
    if (!enabled || pending.current || !client || protocol.current?.api !== api) return;
    pending.current = true;
    let owner: ReturnType<typeof transaction.begin>;
    try {
      owner = transaction.begin();
    } catch (error) {
      pending.current = false;
      setDetail(
        error instanceof UnfinishedReviewDraftError
          ? error.message
          : t(
              'The review is still loading or could not be restored. Resolve the loading error before saving.'
            )
      );
      return;
    }
    active.current = owner;
    setStatus('saving');
    setDetail(null);
    const current = () =>
      protocol.current?.client === client && active.current === owner && owner.current();
    void client
      .finish(owner.state, api, current)
      .catch(error => settleFailure(error, owner, client));
  }, [api, transaction, enabled, t, settleFailure]);
  const check = api.getSaveResult
    ? () => {
        const owner = active.current;
        const client = protocol.current?.client;
        if (!owner?.current() || !client || protocol.current?.api !== api) return;
        const current = () =>
          protocol.current?.client === client && active.current === owner && owner.current();
        void client.inspect(current).catch(error => settleFailure(error, owner, client));
      }
    : undefined;
  return { save, status, detail, check };
}

/** One owner for Finish and Save & Quit, across dialogs and toolbar. */
export function SaveReviewBoundary({
  children,
  api = window.electronAPI,
}: {
  children: React.ReactNode;
  api?: SaveAPI;
}) {
  const control = useOwnedSave(api);
  const { t } = useDesktopLocalization();
  return (
    <SaveContext.Provider value={control}>
      {control.status !== 'reviewing' && (
        <div role='status'>
          {t(
            control.status === 'saving'
              ? 'Saving review…'
              : 'The save outcome is unknown. Check the output file before closing. The review has not been resent.'
          )}
        </div>
      )}
      {control.status === 'unknown' && control.check && (
        <Button data-save-recovery onClick={control.check}>
          {t('Check publication status')}
        </Button>
      )}
      {control.status === 'unknown' && api.discardAndQuit && (
        <div data-save-recovery>
          <p>{t('Discarding closes unsaved work. Anything already written stays on disk.')}</p>
          <Button variant='destructive' onClick={api.discardAndQuit}>
            {t('Discard & Quit')}
          </Button>
        </div>
      )}
      {control.detail && (
        <div role='alert' className='whitespace-pre-wrap'>
          {control.detail}
        </div>
      )}
      <div
        inert={control.status !== 'reviewing'}
        aria-busy={control.status === 'saving'}
        style={{ display: 'contents' }}
        data-testid='desktop-review-interaction'
      >
        {children}
      </div>
    </SaveContext.Provider>
  );
}

export function useSaveReview(api: SaveAPI) {
  const inherited = useContext(SaveContext);
  const own = useOwnedSave(api, inherited === null);
  return inherited?.save ?? own.save;
}
