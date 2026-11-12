import { useLocalization } from '../../localization/LocalizationContext';
import React, { useMemo, useContext } from 'react';
import ReactMarkdown from 'react-markdown';
import { localContentUrlTransform } from '../../utils/passive-content';
import remarkGfm from 'remark-gfm';
import { Map as MapIcon } from 'lucide-react';
import type { DiffFile } from '@self-review/types';
import { SessionStoreContext } from '../../context/review-context';
import { ViewedReview } from '../../context/ViewedReview';
import { useGuide } from '../../context/GuideContext';
import { useReview, useDiffReview } from '../../context/ReviewContext';
import { useOptionalDiffNavigation } from '../../context/DiffNavigationContext';
import { GuideRouteMap } from '../GuideRouteMap';
import { remarkEmoji } from '../../utils/remark-emoji';
import { MarkdownCode } from './MarkdownCode';
import { diffTotals } from '../../utils/diff-totals';

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
export default function GuideOverviewContent(props: GuideOverviewContentProps) {
  const store = useContext(SessionStoreContext);
  return store ? <StoredOverview {...props} /> : <LegacyOverview {...props} />;
}

function StoredOverview(props: GuideOverviewContentProps) {
  const { diffFiles } = useDiffReview();
  return (
    <ViewedReview match='any'>
      {viewedPaths => (
        <OverviewContent {...props} diffFiles={diffFiles} viewedPaths={viewedPaths} />
      )}
    </ViewedReview>
  );
}

function LegacyOverview(props: GuideOverviewContentProps) {
  const { diffFiles } = useReview();
  return (
    <ViewedReview match='any'>
      {viewedPaths => (
        <OverviewContent {...props} diffFiles={diffFiles} viewedPaths={viewedPaths} />
      )}
    </ViewedReview>
  );
}

function OverviewContent({
  onNavigate,
  diffFiles,
  viewedPaths,
}: GuideOverviewContentProps & {
  diffFiles: DiffFile[];
  viewedPaths: ReadonlySet<string>;
}) {
  const { t, number } = useLocalization();
  const { guide } = useGuide();
  const navigation = useOptionalDiffNavigation();

  const { additions, deletions, complete } = useMemo(() => diffTotals(diffFiles), [diffFiles]);

  if (!guide?.overview) return null;

  const groups = guide.groups;
  const totalFiles = groups.reduce((sum, group) => sum + group.files.length, 0);

  const isGroupComplete = (group: (typeof groups)[number]) =>
    group.files.length > 0 && group.files.every(file => viewedPaths.has(file.path));

  return (
    <div>
      <div className='flex flex-wrap items-center justify-between gap-2 select-none'>
        <span className='flex items-center gap-2'>
          <MapIcon className='h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400' />
          <span className='font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground'>
            {t('Review walkthrough')}
          </span>
        </span>
        <span className='font-mono text-[11px] tabular-nums text-muted-foreground'>
          {t('walkthrough totals', { stops: groups.length, files: totalFiles })}
          {!complete && <span> · {t('Line totals unavailable')}</span>}
          {additions > 0 && (
            <span className='text-emerald-600 dark:text-emerald-400'> +{number(additions)}</span>
          )}
          {deletions > 0 && (
            <span className='text-red-600 dark:text-red-400'> −{number(deletions)}</span>
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
          urlTransform={localContentUrlTransform}
          remarkPlugins={[remarkGfm, remarkEmoji]}
          components={{ code: MarkdownCode }}
        >
          {guide.overview}
        </ReactMarkdown>
      </div>
    </div>
  );
}
