import React, { useContext, useState, useSyncExternalStore } from 'react';
import { SessionStoreContext } from '../../context/review-context';
import { draftHasWork } from '../../context/review-drafts';
import { useLocalization } from '../../localization/LocalizationContext';
import { Button } from '../ui/button';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
} from '../ui/alert-dialog';
import CommentInput from './CommentInput';
import ReplyInput from './ReplyInput';

/** Unmounted and off-diff drafts always have a reachable way to recover or discard their text. */
export function ReviewDraftRecovery() {
  const session = useContext(SessionStoreContext)!;
  const store = session.drafts;
  const drafts = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const [editing, setEditing] = useState<string | null>(null);
  const { t } = useLocalization();
  const unfinished = drafts.filter(draftHasWork);
  if (!unfinished.length) return null;
  return (
    <section
      aria-label={t('Unfinished drafts')}
      className='fixed bottom-2 end-2 z-40 max-h-[30vh] max-w-lg overflow-auto rounded-lg border border-border bg-background p-2 space-y-2 shadow-lg'
    >
      {unfinished.map(draft => (
        <div key={draft.key}>
          <span>
            {t('Unfinished draft: {path}', { path: draft.location.filePath || t('Reply') })}
          </span>{' '}
          {!store.isMounted(draft.key) && (
            <Button variant='outline' size='sm' onClick={() => setEditing(draft.key)}>
              {t('Continue draft')}
            </Button>
          )}{' '}
          <Button variant='ghost' size='sm' onClick={() => store.clear(draft.key, draft.token)}>
            {t('Cancel draft')}
          </Button>
          {editing === draft.key && (
            <AlertDialog
              open
              onOpenChange={open => {
                if (!open) setEditing(null);
              }}
            >
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>{t('Continue draft')}</AlertDialogTitle>
                  <AlertDialogDescription>
                    {t('Finish or cancel unfinished drafts before saving the review.')}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {draft.location.commentId ? (
                  <ReplyInput
                    {...draft.location}
                    commentId={draft.location.commentId}
                    onCancel={() => setEditing(null)}
                    onSubmit={() => setEditing(null)}
                  />
                ) : (
                  <CommentInput
                    {...draft.location}
                    onCancel={() => setEditing(null)}
                    onSubmit={() => setEditing(null)}
                  />
                )}
                <AlertDialogCancel>{t('Close')}</AlertDialogCancel>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      ))}
    </section>
  );
}
