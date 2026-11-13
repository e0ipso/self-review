import { applyRefusalSummary } from '../../localization/apply-refusal';
import { useLocalization } from '../../localization/LocalizationContext';
import React, { useState, useLayoutEffect, useRef } from 'react';
import type { LineRange, Suggestion, SuggestionApplyOutcome } from '@self-review/types';
import { Check, CircleAlert, FolderOpen, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import { useAdapter } from '../../context/ReviewAdapterContext';
import { useApplyOperation } from '../../context/apply-operation';
import { useOptionalApplySession } from '../../context/ReviewContext';

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
export default React.memo(function SuggestionApplyControl(props: SuggestionApplyControlProps) {
  const review = useOptionalApplySession();
  const key = JSON.stringify([
    review?.sessionId,
    review?.snapshotId,
    props.filePath,
    props.lineRange,
    props.suggestion,
  ]);
  return <OwnedSuggestionApplyControl key={key} {...props} />;
});

function OwnedSuggestionApplyControl({
  filePath,
  lineRange,
  suggestion,
}: SuggestionApplyControlProps) {
  const { t } = useLocalization();
  const adapter = useAdapter();
  const review = useOptionalApplySession();
  const applySuggestion = adapter?.applySuggestion;
  const chooseApplyDestination = adapter?.chooseApplyDestination;
  const operation = useApplyOperation(JSON.stringify([filePath, lineRange, suggestion]));
  const { outcome, pending: isApplying, unknown } = operation.state;
  const [inspected, setInspected] = useState(false);
  const setOutcome = (outcome: SuggestionApplyOutcome) =>
    operation.write({ pending: false, outcome, unknown: false });

  const mounted = useRef(false);

  useLayoutEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const current = () => mounted.current && (review?.isCurrentSession?.() ?? true);

  if (!applySuggestion) return null;

  // The host refuses paths outside the reviewed diff (`not-reviewed`), so say so instead of
  // offering a button. A placeholder session has nothing to compare against yet.
  const sessionLoaded =
    review !== null && review.diffSource.type !== 'loading' && review.diffSource.type !== 'welcome';
  if (sessionLoaded && !review.reviewedPaths.has(filePath)) {
    return (
      <div
        className='flex items-center gap-1.5 px-3 py-1.5 border-t border-border bg-muted/40 font-sans text-[11px] text-muted-foreground'
        data-testid='suggestion-apply-unreviewed'
      >
        <CircleAlert className='h-3 w-3 flex-shrink-0' />
        <span>
          {t('This file is not in the reviewed diff, so the suggestion cannot be applied.')}
        </span>
      </div>
    );
  }

  const applied = outcome?.status === 'applied';
  const refusalKey =
    outcome?.status === 'refused' ? applyRefusalSummary(outcome.reason) : undefined;
  const refusalSummary = refusalKey ? t(refusalKey) : undefined;

  // The clone is deleted when the review ends, so the reviewed files are not
  // a destination. Either the session says so up front, or the host said so
  // when it refused the last attempt.
  const missingDestination =
    (review?.remote?.temporaryClone === true && review.applyDestination === null) ||
    (outcome?.status === 'refused' && outcome.reason === 'destination-required');
  const askFirst = missingDestination && Boolean(chooseApplyDestination);

  const runApply = async () => {
    try {
      if (!current()) return;
      const result = await applySuggestion({ filePath, lineRange, suggestion });
      if (review?.isCurrentSession?.() ?? mounted.current) setOutcome(result);
    } catch (error) {
      // No answer is evidence of neither refusal nor rollback. The host may have renamed.
      if (!(review?.isCurrentSession?.() ?? mounted.current)) return;
      if (error && typeof error === 'object' && 'uncertain' in error && error.uncertain === false) {
        setOutcome({
          status: 'refused',
          filePath,
          reason: 'request-rejected',
          detail: t('The host rejected the request before applying the proposal.'),
        });
      } else operation.write({ pending: false, outcome: null, unknown: true });
    }
  };

  const handleApply = async () => {
    if (operation.read().pending || operation.read().unknown || !current()) return;
    operation.write({ ...operation.read(), pending: true });
    try {
      await runApply();
    } finally {
      if (review?.isCurrentSession?.() ?? mounted.current)
        operation.write({ ...operation.read(), pending: false });
    }
  };

  const handleChooseAndApply = async () => {
    if (!chooseApplyDestination) return;
    if (operation.read().pending || operation.read().unknown || !current()) return;
    operation.write({ ...operation.read(), pending: true });
    try {
      const chosen = await chooseApplyDestination();
      if (!current()) return;
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
      if (!current()) return;
      setOutcome({
        status: 'refused',
        filePath,
        reason: 'host-unavailable',
        detail: t('The destination could not be chosen.'),
      });
    } finally {
      if (review?.isCurrentSession?.() ?? mounted.current)
        operation.write({ ...operation.read(), pending: false });
    }
  };

  return (
    <div
      className='flex items-center justify-between gap-3 px-3 py-1.5 border-t border-border bg-muted/40 font-sans text-[11px]'
      data-testid='suggestion-apply'
    >
      {unknown ? (
        <div role='status' data-testid='suggestion-apply-outcome' data-status='unknown'>
          <p>
            {t(
              'The apply outcome is unknown. Inspect the destination file before allowing another attempt. Nothing is retried automatically.'
            )}
          </p>
          <label>
            <input
              type='checkbox'
              checked={inspected}
              onChange={event => setInspected(event.target.checked)}
            />
            {t('I inspected the destination file and confirmed this proposal was not applied.')}
          </label>
          <Button
            variant='outline'
            size='sm'
            disabled={!inspected}
            onClick={() => {
              operation.write({ pending: false, outcome: null, unknown: false });
              setInspected(false);
            }}
          >
            {t('Allow a separate retry')}
          </Button>
        </div>
      ) : outcome ? (
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
              {t('Applied suggestion', { path: outcome.filePath, count: outcome.replacedLines })}
            </span>
          ) : (
            <span>
              {t('Not applied. {detail}', { detail: outcome.detail })}
              {refusalSummary && refusalSummary !== outcome.detail && (
                <span className='block'>{refusalSummary}</span>
              )}
            </span>
          )}
        </span>
      ) : (
        <span className='text-muted-foreground'>
          {missingDestination
            ? t(
                'This pull request was cloned into a temporary directory. Choose where to write it.'
              )
            : t('Write the proposal into the working file.')}
        </span>
      )}
      {!applied && !unknown && (
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
          {t(isApplying ? 'Applying…' : askFirst ? 'Choose destination…' : 'Apply')}
        </Button>
      )}
    </div>
  );
}
