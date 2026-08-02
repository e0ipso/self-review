import React, { useState } from 'react';
import { Map as MapIcon } from 'lucide-react';
import { useGuide } from '../context/GuideContext';
import { useReview } from '../context/ReviewContext';
import { useDiffNavigationContext } from '../context/DiffNavigationContext';
import { getGuideAccent } from '../utils/guide-accents';
import GuideOverviewDialog from './DiffViewer/GuideOverviewDialog';

/**
 * Floating wayfinding pill over the diff pane in guided mode: the route as
 * a row of station dots in their line colors, with the stop containing the
 * file currently in view enlarged and named. Dots jump to their group's
 * first file; the map button reopens the walkthrough overview in a dialog
 * so its orientation is one click away at any depth in the review. Tracks
 * scroll position live via the diff navigation context's active file.
 */
export default function GuideRouteHud() {
  const { guide, mode } = useGuide();
  const { files } = useReview();
  const { activeFilePath, scrollToFile } = useDiffNavigationContext();
  const [overviewOpen, setOverviewOpen] = useState(false);

  if (mode !== 'guided' || !guide || guide.groups.length === 0) return null;

  const groups = guide.groups;
  const viewedPaths = new Set(files.filter(f => f.viewed).map(f => f.path));
  const currentIndex = groups.findIndex(group =>
    group.files.some(file => file.path === activeFilePath)
  );
  const current = currentIndex >= 0 ? groups[currentIndex] : null;
  const hasOverview = Boolean(guide.overview);

  return (
    <div className='pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center'>
      <div
        className='pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/90 py-1.5 pl-2 pr-4 shadow-lg backdrop-blur'
        data-testid='guide-route-hud'
      >
        {hasOverview && (
          <>
            <button
              type='button'
              title='Open the walkthrough overview'
              onClick={() => setOverviewOpen(true)}
              className='flex h-6 w-6 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
              data-testid='guide-hud-overview-btn'
            >
              <MapIcon className='h-3.5 w-3.5' />
              <span className='sr-only'>Open the walkthrough overview</span>
            </button>
            <span className='h-4 w-px bg-border' aria-hidden='true' />
          </>
        )}

        <div className='flex items-center gap-1'>
          {groups.map((group, index) => {
            const accent = getGuideAccent(index, group.implicit);
            const isCurrent = index === currentIndex;
            const complete =
              group.files.length > 0 &&
              group.files.every(file => viewedPaths.has(file.path));
            const firstFilePath = group.files[0]?.path;
            return (
              <button
                key={`hud-stop-${index}-${group.name}`}
                type='button'
                title={group.name}
                onClick={
                  firstFilePath
                    ? () => scrollToFile(firstFilePath)
                    : undefined
                }
                className='flex h-5 w-5 items-center justify-center rounded-full transition-colors hover:bg-muted'
              >
                <span
                  className={
                    isCurrent
                      ? `h-3 w-3 rounded-full ${accent.dot}`
                      : complete
                        ? `h-2 w-2 rounded-full ${accent.dotSoft}`
                        : `h-2 w-2 rounded-full ${accent.dotFaint}`
                  }
                  aria-hidden='true'
                />
              </button>
            );
          })}
        </div>
        <span className='max-w-48 truncate font-mono text-[10px] tabular-nums text-muted-foreground'>
          {current
            ? `${currentIndex + 1}/${groups.length} · ${current.name}`
            : `${groups.length} stops`}
        </span>
      </div>

      {hasOverview && (
        <GuideOverviewDialog
          open={overviewOpen}
          onOpenChange={setOverviewOpen}
        />
      )}
    </div>
  );
}
