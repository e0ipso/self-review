import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Map as MapIcon } from 'lucide-react';
import { useGuide } from '../../context/GuideContext';
import { useOptionalDiffNavigation } from '../../context/DiffNavigationContext';
import { GuideStation } from '../GuideStation';
import { remarkEmoji } from '../../utils/remark-emoji';
import { MarkdownCode } from './MarkdownCode';

/**
 * Review-level walkthrough overview. Rendered at the top of the diff viewer
 * scroll container, above the first file section, when a guide with an
 * overview is loaded and the mode is Guided. Markdown (including Mermaid
 * fences) goes through the same pipeline as the rest of the app.
 *
 * Styled as the route map for the walkthrough: a mono masthead, the
 * itinerary as a horizontal transit line of numbered stations (each chip
 * scrolls to its group's first file), then the guide-authored prose.
 */
export default function GuideOverviewPanel() {
  const { guide, mode } = useGuide();
  const navigation = useOptionalDiffNavigation();

  if (mode !== 'guided' || !guide?.overview) return null;

  const groups = guide.groups;
  const totalFiles = groups.reduce((sum, group) => sum + group.files.length, 0);

  return (
    <div
      className='mx-2 mt-2 mb-3 overflow-hidden rounded-lg border border-border bg-background shadow-sm'
      data-testid='guide-overview'
    >
      <div className='flex h-10 items-center justify-between border-b border-border bg-muted/40 px-4 select-none'>
        <span className='flex items-center gap-2'>
          <MapIcon className='h-3.5 w-3.5 text-indigo-600 dark:text-indigo-400' />
          <span className='font-mono text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground'>
            Review walkthrough
          </span>
        </span>
        <span className='font-mono text-[11px] tabular-nums text-muted-foreground'>
          {groups.length} {groups.length === 1 ? 'stop' : 'stops'} ·{' '}
          {totalFiles} {totalFiles === 1 ? 'file' : 'files'}
        </span>
      </div>

      {/* Itinerary: the route as a horizontal transit line. */}
      <div className='flex flex-wrap items-center gap-y-2 px-4 py-3'>
        {groups.map((group, index) => {
          const firstFilePath = group.files[0]?.path;
          const canJump = Boolean(navigation && firstFilePath);
          return (
            <React.Fragment key={`itinerary-${index}-${group.name}`}>
              {index > 0 && (
                <span
                  className={`h-[2px] w-5 shrink-0 ${
                    group.implicit
                      ? 'guide-route-dashed-h'
                      : 'bg-indigo-500/30 dark:bg-indigo-400/30'
                  }`}
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
                className={`flex min-w-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-left transition-colors hover:bg-muted ${canJump ? 'cursor-pointer' : 'cursor-default'}`}
              >
                <GuideStation index={index} implicit={group.implicit} />
                <span className='max-w-56 truncate text-xs font-medium text-foreground'>
                  {group.name}
                </span>
                <span className='font-mono text-[10px] tabular-nums text-muted-foreground'>
                  {group.files.length}
                </span>
              </button>
            </React.Fragment>
          );
        })}
      </div>

      <div className='border-t border-border px-4 py-4'>
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
