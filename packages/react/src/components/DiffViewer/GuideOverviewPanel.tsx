import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Map as MapIcon, ChevronRight, Layers } from 'lucide-react';
import { useGuide } from '../../context/GuideContext';
import { useOptionalDiffNavigation } from '../../context/DiffNavigationContext';
import { getGuideAccent } from '../../utils/guide-accents';
import { remarkEmoji } from '../../utils/remark-emoji';
import { MarkdownCode } from './MarkdownCode';

/**
 * Review-level walkthrough overview. Rendered at the top of the diff viewer
 * scroll container, above the first file section, when a guide with an
 * overview is loaded and the mode is Guided. Markdown (including Mermaid
 * fences) goes through the same pipeline as the rest of the app.
 *
 * Presented as the trailhead of the review journey: a hero header with the
 * itinerary of guide groups (each chip scrolls to its first file), followed
 * by the guide-authored orientation prose.
 */
export default function GuideOverviewPanel() {
  const { guide, mode } = useGuide();
  const navigation = useOptionalDiffNavigation();

  if (mode !== 'guided' || !guide?.overview) return null;

  const groups = guide.groups;
  const totalFiles = groups.reduce((sum, group) => sum + group.files.length, 0);

  return (
    <div
      className='mx-2 mt-2 mb-4 overflow-hidden rounded-xl border border-border shadow-md'
      data-testid='guide-overview'
    >
      {/* Gradient ribbon across the top — the journey's trailhead marker. */}
      <div className='h-1 w-full bg-gradient-to-r from-violet-500 via-sky-500 to-teal-400' />

      <div className='guide-overview-hero px-5 pb-4 pt-4 select-none'>
        <div className='flex items-start justify-between gap-4'>
          <div className='flex min-w-0 items-center gap-3'>
            <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-lg shadow-violet-500/25'>
              <MapIcon className='h-5 w-5' />
            </div>
            <div className='min-w-0'>
              <h2 className='text-[15px] font-semibold leading-tight tracking-tight text-foreground'>
                Review walkthrough
              </h2>
              <p className='mt-0.5 text-xs text-muted-foreground'>
                A suggested path through this change — follow the stops in
                order.
              </p>
            </div>
          </div>

          <div className='flex shrink-0 items-center gap-4 pt-0.5'>
            <div className='text-center'>
              <div className='text-lg font-bold leading-none tabular-nums text-foreground'>
                {groups.length}
              </div>
              <div className='mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground'>
                {groups.length === 1 ? 'Stop' : 'Stops'}
              </div>
            </div>
            <div className='h-7 w-px bg-border' />
            <div className='text-center'>
              <div className='text-lg font-bold leading-none tabular-nums text-foreground'>
                {totalFiles}
              </div>
              <div className='mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground'>
                {totalFiles === 1 ? 'File' : 'Files'}
              </div>
            </div>
          </div>
        </div>

        {/* Itinerary: one chip per guide group, connected in reading order. */}
        <div className='mt-4 flex flex-wrap items-center gap-y-1.5'>
          {groups.map((group, index) => {
            const accent = getGuideAccent(index, group.implicit);
            const firstFilePath = group.files[0]?.path;
            const canJump = Boolean(navigation && firstFilePath);
            return (
              <React.Fragment key={`itinerary-${index}-${group.name}`}>
                {index > 0 && (
                  <ChevronRight
                    className='mx-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40'
                    aria-hidden='true'
                  />
                )}
                <button
                  type='button'
                  onClick={
                    canJump
                      ? () => navigation!.scrollToFile(firstFilePath!)
                      : undefined
                  }
                  title={group.rationale}
                  className={`flex min-w-0 items-center gap-1.5 rounded-full py-1 pl-1 pr-2.5 text-xs font-medium text-foreground transition-colors ${accent.soft} ${canJump ? 'cursor-pointer' : 'cursor-default'}`}
                >
                  <span
                    className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${accent.chip}`}
                  >
                    {group.implicit ? (
                      <Layers className='h-2.5 w-2.5' aria-hidden='true' />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span className='max-w-64 truncate'>{group.name}</span>
                  <span className='text-[10px] tabular-nums text-muted-foreground'>
                    {group.files.length}
                  </span>
                </button>
              </React.Fragment>
            );
          })}
        </div>
      </div>

      <div className='border-t border-border/60 bg-background px-5 py-4'>
        <div className='guide-overview-prose prose prose-sm dark:prose-invert max-w-none'>
          <ReactMarkdown
            remarkPlugins={[remarkGfm, remarkEmoji]}
            components={{ code: MarkdownCode }}
          >
            {guide.overview}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
