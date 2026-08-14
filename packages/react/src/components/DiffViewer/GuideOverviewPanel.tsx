import React from 'react';
import { useGuide } from '../../context/GuideContext';
import GuideOverviewContent from './GuideOverviewContent';

/**
 * The walkthrough trailhead: a full-bleed opening spread rendered above
 * the first chapter of the review when a guide with an overview is loaded
 * and the mode is Guided. The same content is recallable mid-review from
 * the wayfinding HUD's map button (GuideOverviewDialog).
 */
export default function GuideOverviewPanel() {
  const { guide, mode } = useGuide();

  if (mode !== 'guided' || !guide?.overview) return null;

  return (
    <section className='border-b border-border' data-testid='guide-overview'>
      <div className='mx-auto max-w-4xl px-6 pb-7 pt-7'>
        <GuideOverviewContent />
      </div>
    </section>
  );
}
