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
    // Host-driven save: push state before triggering main-process save
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
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Save your review?</AlertDialogTitle>
          <AlertDialogDescription>
            You have unsaved review work. What would you like to do?
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            className='bg-destructive text-destructive-foreground hover:bg-destructive/90'
            onClick={handleDiscard}
          >
            Discard
          </AlertDialogAction>
          <AlertDialogAction onClick={handleSaveAndQuit}>
            Save & Quit
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
