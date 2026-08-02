import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from '../ui/dialog';
import GuideOverviewContent from './GuideOverviewContent';

export interface GuideOverviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * The walkthrough overview, recallable mid-review. Opened from the
 * wayfinding HUD's map button so the route map and orientation prose are
 * one click away at any depth in the diff — jumping to a station closes
 * the dialog to reveal the target.
 */
export default function GuideOverviewDialog({
  open,
  onOpenChange,
}: GuideOverviewDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className='block max-h-[85vh] max-w-3xl overflow-y-auto'
        data-testid='guide-overview-dialog'
      >
        <DialogTitle className='sr-only'>Review walkthrough</DialogTitle>
        <GuideOverviewContent onNavigate={() => onOpenChange(false)} />
      </DialogContent>
    </Dialog>
  );
}
