/**
 * Per-group accent tokens for the guided walkthrough.
 *
 * Each chapter of the walkthrough is a leg of the route, and like a metro
 * network map every leg gets its own line color: the same hue appears on
 * the group's sidebar segment and station, its leg and station on the
 * overview route map, its chapter numeral and strip dot, its HUD dot, and
 * the waypoint dot on each of its files — so membership reads at a glance
 * anywhere in the review. Color is always redundant with the stop number,
 * never the sole encoding.
 *
 * Six hues, chosen for adjacent distinctness and to avoid reading as diff
 * semantics (additions green / deletions red). Guides with more than six
 * explicit groups cycle the palette. The implicit "Everything else" group
 * is deliberately neutral: an appendix, not a line on the map.
 *
 * All values are complete literal Tailwind class strings (never composed
 * at runtime) so the Tailwind build can see them.
 */
export interface GuideAccent {
  /** Accent-tinted text. */
  text: string;
  /** Station ring (ring utilities — border-color is reset app-wide). */
  ring: string;
  /** Solid dot / filled station background. */
  dot: string;
  /** Half-strength dot (visited stops in strips). */
  dotSoft: string;
  /** Quarter-strength dot (upcoming stops in strips). */
  dotFaint: string;
  /** Sidebar route segment fill. */
  segment: string;
  /** SVG stroke for the station outline. */
  stroke: string;
  /** SVG stroke for the route leg arriving at this station. */
  strokeSoft: string;
  /** SVG station fill when the group is fully reviewed. */
  fill: string;
  /** SVG station number fill. */
  fillText: string;
  /** Chapter numeral outline color (inline -webkit-text-stroke). */
  numeralStroke: string;
}

const ACCENTS: GuideAccent[] = [
  {
    text: 'text-indigo-600 dark:text-indigo-400',
    ring: 'ring-indigo-500 dark:ring-indigo-400',
    dot: 'bg-indigo-500 dark:bg-indigo-400',
    dotSoft: 'bg-indigo-500/50 dark:bg-indigo-400/50',
    dotFaint: 'bg-indigo-500/25 dark:bg-indigo-400/25',
    segment: 'bg-indigo-500/35 dark:bg-indigo-400/35',
    stroke: 'stroke-indigo-500 dark:stroke-indigo-400',
    strokeSoft: 'stroke-indigo-500/45 dark:stroke-indigo-400/45',
    fill: 'fill-indigo-500 dark:fill-indigo-400',
    fillText: 'fill-indigo-600 dark:fill-indigo-400',
    numeralStroke: 'rgb(99 102 241 / 0.34)',
  },
  {
    text: 'text-teal-600 dark:text-teal-400',
    ring: 'ring-teal-500 dark:ring-teal-400',
    dot: 'bg-teal-500 dark:bg-teal-400',
    dotSoft: 'bg-teal-500/50 dark:bg-teal-400/50',
    dotFaint: 'bg-teal-500/25 dark:bg-teal-400/25',
    segment: 'bg-teal-500/35 dark:bg-teal-400/35',
    stroke: 'stroke-teal-500 dark:stroke-teal-400',
    strokeSoft: 'stroke-teal-500/45 dark:stroke-teal-400/45',
    fill: 'fill-teal-500 dark:fill-teal-400',
    fillText: 'fill-teal-600 dark:fill-teal-400',
    numeralStroke: 'rgb(20 184 166 / 0.34)',
  },
  {
    text: 'text-amber-600 dark:text-amber-400',
    ring: 'ring-amber-500 dark:ring-amber-400',
    dot: 'bg-amber-500 dark:bg-amber-400',
    dotSoft: 'bg-amber-500/50 dark:bg-amber-400/50',
    dotFaint: 'bg-amber-500/25 dark:bg-amber-400/25',
    segment: 'bg-amber-500/35 dark:bg-amber-400/35',
    stroke: 'stroke-amber-500 dark:stroke-amber-400',
    strokeSoft: 'stroke-amber-500/45 dark:stroke-amber-400/45',
    fill: 'fill-amber-500 dark:fill-amber-400',
    fillText: 'fill-amber-600 dark:fill-amber-400',
    numeralStroke: 'rgb(245 158 11 / 0.34)',
  },
  {
    text: 'text-rose-600 dark:text-rose-400',
    ring: 'ring-rose-500 dark:ring-rose-400',
    dot: 'bg-rose-500 dark:bg-rose-400',
    dotSoft: 'bg-rose-500/50 dark:bg-rose-400/50',
    dotFaint: 'bg-rose-500/25 dark:bg-rose-400/25',
    segment: 'bg-rose-500/35 dark:bg-rose-400/35',
    stroke: 'stroke-rose-500 dark:stroke-rose-400',
    strokeSoft: 'stroke-rose-500/45 dark:stroke-rose-400/45',
    fill: 'fill-rose-500 dark:fill-rose-400',
    fillText: 'fill-rose-600 dark:fill-rose-400',
    numeralStroke: 'rgb(244 63 94 / 0.34)',
  },
  {
    text: 'text-sky-600 dark:text-sky-400',
    ring: 'ring-sky-500 dark:ring-sky-400',
    dot: 'bg-sky-500 dark:bg-sky-400',
    dotSoft: 'bg-sky-500/50 dark:bg-sky-400/50',
    dotFaint: 'bg-sky-500/25 dark:bg-sky-400/25',
    segment: 'bg-sky-500/35 dark:bg-sky-400/35',
    stroke: 'stroke-sky-500 dark:stroke-sky-400',
    strokeSoft: 'stroke-sky-500/45 dark:stroke-sky-400/45',
    fill: 'fill-sky-500 dark:fill-sky-400',
    fillText: 'fill-sky-600 dark:fill-sky-400',
    numeralStroke: 'rgb(14 165 233 / 0.34)',
  },
  {
    text: 'text-violet-600 dark:text-violet-400',
    ring: 'ring-violet-500 dark:ring-violet-400',
    dot: 'bg-violet-500 dark:bg-violet-400',
    dotSoft: 'bg-violet-500/50 dark:bg-violet-400/50',
    dotFaint: 'bg-violet-500/25 dark:bg-violet-400/25',
    segment: 'bg-violet-500/35 dark:bg-violet-400/35',
    stroke: 'stroke-violet-500 dark:stroke-violet-400',
    strokeSoft: 'stroke-violet-500/45 dark:stroke-violet-400/45',
    fill: 'fill-violet-500 dark:fill-violet-400',
    fillText: 'fill-violet-600 dark:fill-violet-400',
    numeralStroke: 'rgb(139 92 246 / 0.34)',
  },
];

const IMPLICIT_ACCENT: GuideAccent = {
  text: 'text-muted-foreground',
  ring: 'ring-muted-foreground/40',
  dot: 'bg-muted-foreground/60',
  dotSoft: 'bg-muted-foreground/40',
  dotFaint: 'bg-muted-foreground/25',
  segment: 'bg-muted-foreground/25',
  stroke: 'stroke-muted-foreground/60',
  strokeSoft: 'stroke-muted-foreground/50',
  fill: 'fill-muted-foreground/60',
  fillText: 'fill-muted-foreground',
  numeralStroke: 'hsl(240 4% 46% / 0.3)',
};

/** Accent for the group at `index` in display order. */
export function getGuideAccent(index: number, implicit = false): GuideAccent {
  if (implicit) return IMPLICIT_ACCENT;
  return ACCENTS[index % ACCENTS.length];
}
