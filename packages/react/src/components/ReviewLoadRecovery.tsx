import React from 'react';
import { useReviewLoadState } from '../context/ReviewLoadContext';
import { useLocalization } from '../localization/LocalizationContext';
import { Button } from './ui/button';

/** Recovery presentation stays independent of session reconciliation and host request ordering. */
export function ReviewLoadRecovery() {
  const { loadError, resumeError, retryLoad, retryResume } = useReviewLoadState();
  const { t } = useLocalization();
  return (
    <>
      {loadError && (
        <div role='alert' className='m-3 rounded border border-destructive p-3 text-sm'>
          <p>{t('The review could not be loaded. {detail}', { detail: loadError })}</p>
          <Button onClick={() => void retryLoad?.()}>{t('Retry loading review')}</Button>
        </div>
      )}
      {resumeError && (
        <div role='alert' className='m-3 rounded border border-destructive p-3 text-sm'>
          <p>{t('Saved feedback could not be loaded. {detail}', { detail: resumeError })}</p>
          <Button onClick={() => void retryResume?.()}>{t('Retry loading saved feedback')}</Button>
        </div>
      )}
    </>
  );
}
