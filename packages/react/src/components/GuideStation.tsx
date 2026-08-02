import React from 'react';
import { Check, Layers } from 'lucide-react';

export interface GuideStationProps {
  /** Zero-based position of the group in display order. */
  index: number;
  /** True for the derived trailing "Everything else" group. */
  implicit: boolean;
  /** True when every file in the group has been marked viewed. */
  complete?: boolean;
  /**
   * Background class matching the surface the station sits on, so the
   * marker masks the route line behind it. Ignored when complete (the
   * station fills solid).
   */
  surfaceClassName?: string;
  /** Extra classes (positioning, z-index). */
  className?: string;
}

/**
 * Transit-map station marker for the guided walkthrough: a ring-outlined
 * circle carrying the stop number. Explicit stops ring in the route accent
 * and fill solid with a check once their group is fully reviewed; the
 * implicit "Everything else" stop rings in muted gray with a layers glyph,
 * marking it as an appendix rather than a stop on the authored route.
 *
 * Shared by the file tree (vertical route) and the overview itinerary
 * (horizontal route) so both surfaces speak the same visual language.
 */
export function GuideStation({
  index,
  implicit,
  complete = false,
  surfaceClassName = 'bg-background',
  className = '',
}: GuideStationProps) {
  const ring = implicit
    ? 'ring-muted-foreground/40'
    : 'ring-indigo-500 dark:ring-indigo-400';
  const fill = complete
    ? implicit
      ? 'bg-muted-foreground/60 text-background'
      : 'bg-indigo-600 text-white dark:bg-indigo-500'
    : implicit
      ? `${surfaceClassName} text-muted-foreground`
      : `${surfaceClassName} text-indigo-600 dark:text-indigo-400`;

  return (
    <span
      className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full ring-2 text-[10px] font-semibold leading-none ${ring} ${fill} ${className}`}
      aria-hidden='true'
    >
      {complete ? (
        <Check className='h-3 w-3' />
      ) : implicit ? (
        <Layers className='h-3 w-3' />
      ) : (
        index + 1
      )}
    </span>
  );
}
