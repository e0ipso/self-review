import React, { useState } from 'react';
import type { LineRange, Suggestion, SuggestionApplyOutcome } from '@self-review/types';
import { Check, CircleAlert, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { useOptionalReview } from '../../context/ReviewContext';

export interface SuggestionApplyControlProps {
  /** Path of the file the suggestion is anchored in, relative to the review root. */
  filePath: string;
  /** The owning comment's anchor. `null` (file-level) is refused by the host. */
  lineRange: LineRange | null;
  suggestion: Suggestion;
}

/**
 * Apply control for one suggestion, plus the outcome of the last attempt.
 *
 * It renders nothing unless the host adapter implements `applySuggestion`.
 * In the webapp harness, and in any embedding with no writable destination,
 * there is no control to click (PRD Section 5.4.8).
 *
 * Every attempt reports its own result next to its own suggestion, and
 * nothing retries on its own. A refusal leaves the button in place, so the
 * reviewer can fix the file and press it again. A success retires the
 * button, because the lines it matched are no longer on disk.
 *
 * A remote review materialized into a temporary clone has nowhere to write
 * until the reviewer names a directory, so the control asks for one first
 * and applies straight after. The host still refuses an attempt made
 * without a destination, so this only saves a wasted click.
 */
export default function SuggestionApplyControl({
  filePath,
  lineRange,
  suggestion,
}: SuggestionApplyControlProps) {
  const adapter = useAdapter();
  const review = useOptionalReview();
  const applySuggestion = adapter?.applySuggestion;
  const chooseApplyDestination = adapter?.chooseApplyDestination;
  const [outcome, setOutcome] = useState<SuggestionApplyOutcome | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  if (!applySuggestion) return null;

  const applied = outcome?.status === 'applied';

  // The clone is deleted when the review ends, so the reviewed files are not
  // a destination. Either the session says so up front, or the host said so
  // when it refused the last attempt.
  const missingDestination =
    (review?.remote?.temporaryClone === true && review.applyDestination === null) ||
    (outcome?.status === 'refused' && outcome.reason === 'destination-required');
  const askFirst = missingDestination && Boolean(chooseApplyDestination);

  const runApply = async () => {
    try {
      setOutcome(await applySuggestion({ filePath, lineRange, suggestion }));
    } catch {
      // A throw means the host failed to answer, which is a different
      // thing from the engine refusing. Report it in the same shape, so
      // the reviewer reads one vocabulary, and leak nothing about why.
      setOutcome({
        status: 'refused',
        filePath,
        reason: 'host-unavailable',
        detail: 'The apply request could not be completed.',
      });
    }
  };

  const handleApply = async () => {
    setIsApplying(true);
    try {
      await runApply();
    } finally {
      setIsApplying(false);
    }
  };

  const handleChooseAndApply = async () => {
    if (!chooseApplyDestination) return;
    setIsApplying(true);
    try {
      const chosen = await chooseApplyDestination();
      if (chosen.status === 'cancelled') return;
      if (chosen.status === 'rejected') {
        setOutcome({
          status: 'refused',
          filePath,
          reason: chosen.reason,
          detail: chosen.detail,
        });
        return;
      }
      review?.setApplyDestination(chosen.destinationRoot);
      await runApply();
    } catch {
      setOutcome({
        status: 'refused',
        filePath,
        reason: 'host-unavailable',
        detail: 'The destination could not be chosen.',
      });
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      className='flex items-center justify-between gap-3 px-3 py-1.5 border-t border-border bg-muted/40 font-sans text-[11px]'
      data-testid='suggestion-apply'
    >
      {outcome ? (
        <span
          className={`flex items-start gap-1.5 ${
            applied
              ? 'text-emerald-700 dark:text-emerald-400'
              : 'text-amber-700 dark:text-amber-400'
          }`}
          role='status'
          data-testid='suggestion-apply-outcome'
          data-status={outcome.status}
          data-reason={outcome.status === 'refused' ? outcome.reason : undefined}
        >
          {applied ? (
            <Check className='h-3 w-3 mt-px flex-shrink-0' />
          ) : (
            <CircleAlert className='h-3 w-3 mt-px flex-shrink-0' />
          )}
          {outcome.status === 'applied' ? (
            <span>
              Applied to {outcome.filePath}. Replaced {outcome.replacedLines} line
              {outcome.replacedLines === 1 ? '' : 's'}.
            </span>
          ) : (
            <span>Not applied. {outcome.detail}</span>
          )}
        </span>
      ) : (
        <span className='text-muted-foreground'>
          {missingDestination
            ? 'This pull request was cloned into a temporary directory. Choose where to write it.'
            : 'Write the proposal into the working file.'}
        </span>
      )}
      {!applied && (
        <Button
          variant='outline'
          size='sm'
          className='h-6 shrink-0 px-2 text-[11px]'
          disabled={isApplying}
          onClick={askFirst ? handleChooseAndApply : handleApply}
          data-testid={askFirst ? 'suggestion-apply-choose-destination' : 'suggestion-apply-button'}
        >
          {isApplying && <Loader2 className='h-3 w-3 animate-spin' />}
          {!isApplying && askFirst && <FolderOpen className='h-3 w-3' />}
          {isApplying ? 'Applying…' : askFirst ? 'Choose destination…' : 'Apply'}
        </Button>
      )}
    </div>
  );
}
