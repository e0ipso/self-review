import { useCallback } from 'react';
import { useReview } from '../../packages/react/src/context/ReviewContext';
import type { ElectronAPI } from '../shared/types';

/** Both Finish Review and Save & Quit push the current state before requesting publication. */
export function useSaveReview(api: Pick<ElectronAPI, 'submitReview' | 'saveAndQuit'>) {
  const { diffSource, files } = useReview();
  return useCallback(() => {
    api.submitReview({ timestamp: new Date().toISOString(), source: diffSource, files });
    api.saveAndQuit();
  }, [api, diffSource, files]);
}
