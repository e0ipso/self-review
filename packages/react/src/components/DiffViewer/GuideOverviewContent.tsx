import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Map as MapIcon } from 'lucide-react';
import { useGuide } from '../../context/GuideContext';
import { useReview } from '../../context/ReviewContext';
import { useOptionalDiffNavigation } from '../../context/DiffNavigationContext';
import { GuideRouteMap } from '../GuideRouteMap';
import { remarkEmoji } from '../../utils/remark-emoji';
import { MarkdownCode } from './MarkdownCode';

export interface GuideOverviewContentProps {
  /**
   * Called after a station jump is performed — the dialog passes this to
   * close itself so the jump target is visible.
   */
  onNavigate?: () => void;
}

/**
 * The walkthrough overview's content: mono masthead with route totals, the
 * route map (live against viewed state, stations jump to their group's
 * first file), and the guide-authored orientation prose. Rendered in two
 * places — the trailhead at the top of the review and the recall dialog
 * opened from the wayfinding HUD — so both always show the same thing.
 */
export default function GuideOverviewContent({
  onNavigate,
}: GuideOverviewContentProps) {
  const { guide } = useGuide();
  const { diffFiles, files } = useReview();
  const navigation = useOptionalDiffNavigation();

  if (!guide?.overview) return null;

  const groups = guide.groups;
  const totalFiles = groups.reduce((sum, group) => sum + group.files.length, 0);

  const viewedPaths = new Set(
    (files ?? []).filter(f => f.viewed).map(f => f.path)
  );
  const isGroupComplete = (group: (typeof groups)[number]) =>
    group.files.length > 0 &&
    group.files.every(file => viewedPaths.has(file.path));

  let additions = 0;
  let deletions = 0;
  for (const file of diffFiles) {
    for (const hunk of file.hunks) {
      for (const line of hunk.lines) {
        if (line.type === 'addition') additions++;
        else if (line.type === 'deletion') deletions++;
      }
    }
  }

  return (
    <div>
      <div className='flex flex-wrap items-center justify-between gap-2 select-none'>
        <span className='flex items-center gap-2'>
          <MapIcon className='h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400' />
          <span className='font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground'>
            Review walkthrough
          </span>
        </span>
        <span className='font-mono text-[11px] tabular-nums text-muted-foreground'>
          {groups.length} {groups.length === 1 ? 'stop' : 'stops'} ·{' '}
          {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
          {additions > 0 && (
            <span className='text-emerald-600 dark:text-emerald-400'>
              {' '}
              +{additions}
            </span>
          )}
          {deletions > 0 && (
            <span className='text-red-600 dark:text-red-400'>
              {' '}
              −{deletions}
            </span>
          )}
        </span>
      </div>

      <div className='mt-4'>
        <GuideRouteMap
          groups={groups}
          isGroupComplete={isGroupComplete}
          onJump={
            navigation
              ? path => {
                  navigation.scrollToFile(path);
                  onNavigate?.();
                }
              : undefined
          }
        />
      </div>

      <div className='guide-overview-prose prose prose-sm dark:prose-invert mt-5 max-w-none'>
        <ReactMarkdown
          remarkPlugins={[remarkGfm, remarkEmoji]}
          components={{ code: MarkdownCode }}
        >
          {guide.overview}
        </ReactMarkdown>
      </div>
    </div>
  );
}
