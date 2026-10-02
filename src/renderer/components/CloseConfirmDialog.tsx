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
import { useReview } from '../../../packages/react/src/context/ReviewContext';

export default function CloseConfirmDialog() {
  const [open, setOpen] = useState(false);
  const { files, diffSource } = useReview();

  const hasComments = files.some(f => f.comments.length > 0);

  useEffect(() => {
    return window.electronAPI.onCloseRequested(() => {
      if (!hasComments) {
        window.electronAPI.discardAndQuit();
        return;
      }
      setOpen(true);
    });
  }, [hasComments]);

  const handleSaveAndQuit = () => {
    // Push state before main saves; a failed save leaves the review as it is.
    window.electronAPI.submitReview({
      timestamp: new Date().toISOString(),
      source: diffSource,
      files,
    });
    window.electronAPI.saveAndQuit();
  };

  const handleDiscard = () => {
    window.electronAPI.discardAndQuit();
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
