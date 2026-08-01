import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Map as MapIcon } from 'lucide-react';
import { useGuide } from '../../context/GuideContext';
import { remarkEmoji } from '../../utils/remark-emoji';
import { MarkdownCode } from './MarkdownCode';

/**
 * Review-level walkthrough overview. Rendered at the top of the diff viewer
 * scroll container, above the first file section, when a guide with an
 * overview is loaded and the mode is Guided. Markdown (including Mermaid
 * fences) goes through the same pipeline as the rest of the app.
 */
export default function GuideOverviewPanel() {
  const { guide, mode } = useGuide();

  if (mode !== 'guided' || !guide?.overview) return null;

  return (
    <div
      className='mx-2 mt-2 border border-border rounded-lg shadow-sm'
      data-testid='guide-overview'
    >
      <div className='flex items-center gap-2 h-10 px-3 bg-muted/80 border-b border-border rounded-t-lg select-none'>
        <MapIcon className='h-4 w-4 text-muted-foreground' />
        <span className='text-[13px] font-medium'>Review walkthrough</span>
      </div>
      <div className='prose dark:prose-invert max-w-none p-4'>
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
