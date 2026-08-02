import React from 'react';
import { useReview } from '../../context/ReviewContext';
import type {
  GuideDisplayEntry,
  GuideDisplayHeader,
} from '../../utils/guide-display';

export interface GuideChapterDividerProps {
  header: GuideDisplayHeader;
  /** Zero-based position of this chapter in display order. */
  index: number;
  /** Number of chapters in the walkthrough (implicit group included). */
  totalStops: number;
  entries: GuideDisplayEntry[];
}

/**
 * Chapter opener rendered in the diff stream before each guide group's file
 * sections when the walkthrough is active. A full-bleed band — deliberately
 * not a card, so chapters read as structure and files read as content —
 * with a large outlined stop numeral, the group's rationale, and a dot
 * strip locating this stop on the route.
 */
export default function GuideChapterDivider({
  header,
  index,
  totalStops,
  entries,
}: GuideChapterDividerProps) {
  const { files } = useReview();

  const viewedCount = entries.filter(({ file }) => {
    const path = file.newPath || file.oldPath;
    return files.find(f => f.path === path)?.viewed;
  }).length;

  return (
    <section
      className='relative mt-5 overflow-hidden border-y border-border/60 bg-muted/20 px-6 py-5'
      data-testid={`guide-chapter-${header.name}`}
    >
      {!header.implicit && (
        <span
          className='guide-chapter-numeral pointer-events-none absolute -top-4 right-2 select-none font-mono text-[104px] font-bold leading-none'
          aria-hidden='true'
        >
          {String(index + 1).padStart(2, '0')}
        </span>
      )}

      <div className='relative'>
        <div className='font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground'>
          {header.implicit ? 'Appendix' : `Stop ${index + 1} of ${totalStops}`}{' '}
          · {entries.length} {entries.length === 1 ? 'file' : 'files'} ·{' '}
          {viewedCount}/{entries.length} reviewed
        </div>
        <h3 className='mt-1.5 text-xl font-bold tracking-tight text-foreground'>
          {header.name}
        </h3>
        {header.rationale && (
          <p className='mt-1 max-w-2xl text-[13px] leading-relaxed text-muted-foreground'>
            {header.rationale}
          </p>
        )}

        <div className='mt-3 flex items-center gap-1.5' aria-hidden='true'>
          {Array.from({ length: totalStops }, (_, stop) => (
            <span
              key={stop}
              className={
                stop === index
                  ? 'h-2 w-2 rounded-full bg-indigo-500 dark:bg-indigo-400'
                  : stop < index
                    ? 'h-1.5 w-1.5 rounded-full bg-indigo-500/50 dark:bg-indigo-400/50'
                    : 'h-1.5 w-1.5 rounded-full bg-muted-foreground/25'
              }
            />
          ))}
        </div>
      </div>
    </section>
  );
}
