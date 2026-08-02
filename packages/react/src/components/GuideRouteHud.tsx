import React from 'react';
import { useGuide } from '../context/GuideContext';
import { useReview } from '../context/ReviewContext';
import { useDiffNavigationContext } from '../context/DiffNavigationContext';

/**
 * Floating wayfinding pill over the diff pane in guided mode: the route as
 * a row of station dots, with the stop containing the file currently in
 * view enlarged and named. Dots jump to their group's first file. Tracks
 * scroll position live via the diff navigation context's active file.
 */
export default function GuideRouteHud() {
  const { guide, mode } = useGuide();
  const { files } = useReview();
  const { activeFilePath, scrollToFile } = useDiffNavigationContext();

  if (mode !== 'guided' || !guide || guide.groups.length === 0) return null;

  const groups = guide.groups;
  const viewedPaths = new Set(files.filter(f => f.viewed).map(f => f.path));
  const currentIndex = groups.findIndex(group =>
    group.files.some(file => file.path === activeFilePath)
  );
  const current = currentIndex >= 0 ? groups[currentIndex] : null;

  return (
    <div className='pointer-events-none absolute inset-x-0 bottom-4 z-30 flex justify-center'>
      <div
        className='pointer-events-auto flex items-center gap-2 rounded-full border border-border bg-background/90 py-1.5 pl-3 pr-4 shadow-lg backdrop-blur'
        data-testid='guide-route-hud'
      >
        <div className='flex items-center gap-1'>
          {groups.map((group, index) => {
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
                      ? 'h-3 w-3 rounded-full bg-indigo-500 ring-2 ring-indigo-500/30 dark:bg-indigo-400 dark:ring-indigo-400/30'
                      : complete
                        ? 'h-2 w-2 rounded-full bg-indigo-500/60 dark:bg-indigo-400/60'
                        : group.implicit
                          ? 'h-2 w-2 rounded-full border border-dashed border-muted-foreground/60'
                          : 'h-2 w-2 rounded-full border-2 border-muted-foreground/40'
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
    </div>
  );
}
