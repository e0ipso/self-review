import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import {
  useReviewSaveTransaction,
  useReviewSessionId,
  useReviewSnapshotId,
} from '../../packages/react/src/context/ReviewContext';
import type { ElectronAPI } from '../shared/types';
import { Button } from '../../packages/react/src/components/ui/button';
import { useDesktopLocalization } from './useDesktopLocalization';

type SaveAPI = Pick<
  ElectronAPI,
  | 'submitReview'
  | 'saveAndQuit'
  | 'saveReview'
  | 'acknowledgeReviewSave'
  | 'onSaveFailed'
  | 'getSaveResult'
> &
  Partial<Pick<ElectronAPI, 'discardAndQuit'>>;
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
  const deadline = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const live = useRef(true);
  const active = useRef<ReturnType<typeof transaction.begin> | null>(null);
  const session = useReviewSessionId();
  const snapshot = useReviewSnapshotId();
  useEffect(() => {
    if (!enabled) return;
    live.current = true;
    return () => {
      live.current = false;
      clearTimeout(deadline.current);
    };
  }, [enabled]);
  useEffect(() => {
    if (!enabled) return;
    clearTimeout(deadline.current);
    pending.current = false;
    active.current = null;
    setStatus('reviewing');
    setDetail(null);
  }, [enabled, session, snapshot]);
  useEffect(() => {
    if (!enabled) return;
    return api.onSaveFailed?.(() => {
      if (!active.current?.current()) return;
      active.current.unlock();
      pending.current = false;
      setStatus('reviewing');
    });
  }, [api, enabled]);

  // Capture protects document-level shortcuts and the interval before React sets inert.
  useEffect(() => {
    if (!enabled) return;
    const block = (event: Event) => {
      if (
        !pending.current ||
        (event.target instanceof Element && event.target.closest('[data-save-recovery]'))
      )
        return;
      event.preventDefault();
      event.stopImmediatePropagation();
    };
    const names = [
      'keydown',
      'click',
      'beforeinput',
      'input',
      'change',
      'submit',
      'trigger-line-comment',
    ];
    names.forEach(name => window.addEventListener(name, block, true));
    return () => names.forEach(name => window.removeEventListener(name, block, true));
  }, [enabled]);

  const save = useCallback(() => {
    if (!enabled || pending.current) return;
    pending.current = true;
    let owner: ReturnType<typeof transaction.begin>;
    try {
      owner = transaction.begin();
    } catch {
      pending.current = false;
      setDetail(
        t(
          'The review is still loading or could not be restored. Resolve the loading error before saving.'
        )
      );
      return;
    }
    active.current = owner;
    setStatus('saving');
    setDetail(null);
    const current = () => live.current && active.current === owner && owner.current();
    // Old counterparts retain their two ordered event calls; absence of a receipt never
    // becomes a fabricated success. Their failure push can restore editing.
    if (!api.saveReview || !api.acknowledgeReviewSave) {
      try {
        api.submitReview(owner.state);
        api.saveAndQuit();
        // A legacy host has no publication receipt. Never leave it looking acknowledged.
        if (current()) setStatus('unknown');
      } catch {
        if (current()) setStatus('unknown');
      }
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    void Promise.race([
      api.saveReview(owner.state),
      new Promise<never>((_resolve, reject) => {
        timer = deadline.current = setTimeout(
          () => reject(new Error('Save receipt unavailable')),
          60_000
        );
      }),
    ])
      .then(result => {
        if (!current()) return;
        if (result.status === 'saved') {
          api.acknowledgeReviewSave!(result.receipt);
        } else if (result.status === 'failed') {
          owner.unlock();
          pending.current = false;
          setDetail(`${result.message}\n\n${result.detail}`);
          setStatus('reviewing');
        } else {
          // Another transaction owns the write. Do not unlock or replay this snapshot.
          setStatus('unknown');
        }
      })
      .catch(() => {
        if (current()) setStatus('unknown');
      })
      .finally(() => clearTimeout(timer));
  }, [api, transaction, enabled, t]);
  const check = api.getSaveResult
    ? () => {
        const owner = active.current;
        void api.getSaveResult!()
          .then(result => {
            if (!live.current || !owner?.current() || active.current !== owner) return;
            if (result?.status === 'saved') api.acknowledgeReviewSave?.(result.receipt);
            if (result?.status === 'failed') {
              owner.unlock();
              pending.current = false;
              setDetail(`${result.message}\n\n${result.detail}`);
              setStatus('reviewing');
            }
          })
          .catch(() => {});
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
