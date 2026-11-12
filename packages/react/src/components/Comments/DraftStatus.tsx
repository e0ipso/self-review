import React from 'react';
import { useLocalization } from '../../localization/LocalizationContext';
import type { useReviewDraft } from '../../hooks/useReviewDraft';
import { Button } from '../ui/button';

export function DraftStatus({ editor }: { editor: ReturnType<typeof useReviewDraft> }) {
  const { t } = useLocalization();
  return (
    <>
      {editor.draft.stale && (
        <div role='alert' className='p-3 space-y-2'>
          <p>
            {t(
              'The reviewed content changed. Check this draft against the current diff before continuing.'
            )}
          </p>
          {editor.canRebind && (
            <Button variant='outline' onClick={editor.rebind}>
              {t('Use current location')}
            </Button>
          )}
          {editor.canMakeFileComment && (
            <Button variant='outline' onClick={editor.makeFileComment}>
              {t('Keep as file comment')}
            </Button>
          )}
        </div>
      )}
      {editor.draft.interrupted && (
        <div role='alert' className='p-3'>
          <p>
            {t('Attachment preparation was interrupted. Attach the image again before saving.')}
          </p>
          <Button variant='ghost' onClick={editor.dismissInterrupted}>
            {t('Dismiss')}
          </Button>
        </div>
      )}
    </>
  );
}
