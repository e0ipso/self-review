import type { ElectronAPI } from '../../shared/types';
import React, { useState, useEffect } from 'react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../../../packages/react/src/components/ui/alert-dialog';
import { useUnsavedReviewWork } from '../useUnsavedReviewWork';
import { useReview } from '../../../packages/react/src/context/ReviewContext';

type CloseConfirmDialogAPI = Pick<
  ElectronAPI,
  'onCloseRequested' | 'discardAndQuit' | 'submitReview' | 'saveAndQuit'
>;

export default function CloseConfirmDialog({
  api = window.electronAPI,
}: {
  api?: CloseConfirmDialogAPI;
}) {
  const [open, setOpen] = useState(false);
  const { files, diffSource } = useReview();

  const hasUnsavedWork = useUnsavedReviewWork();

  useEffect(() => {
    return api.onCloseRequested(() => {
      if (!hasUnsavedWork) {
        api.discardAndQuit();
        return;
      }
      setOpen(true);
    });
  }, [hasUnsavedWork, api]);

  const handleSaveAndQuit = () => {
    // Push state before main saves; a failed save leaves the review as it is.
    api.submitReview({
      timestamp: new Date().toISOString(),
      source: diffSource,
      files,
    });
    api.saveAndQuit();
  };

  const handleDiscard = () => {
    api.discardAndQuit();
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent data-testid='close-confirm-dialog'>
        <AlertDialogHeader>
          <AlertDialogTitle>Save your review?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved review work. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel data-testid='close-confirm-cancel'>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            data-testid='close-confirm-discard'
            onClick={handleDiscard}
          >
            Discard
          </AlertDialogAction>
          <AlertDialogAction data-testid='close-confirm-save' onClick={handleSaveAndQuit}>
            Save & Quit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
