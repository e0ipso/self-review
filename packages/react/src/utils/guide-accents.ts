/**
 * Per-group accent palette for the guided walkthrough UI.
 *
 * Each explicit guide group gets a stable accent by cycling this palette in
 * display order, so the numbered step in the file tree, the itinerary chip in
 * the overview panel, and the group's progress bar all share one hue. The
 * implicit trailing "Everything else" group uses a deliberately neutral
 * accent so it reads as an appendix, not another stop on the journey.
 *
 * All values are complete literal Tailwind class strings (never composed at
 * runtime) so the Tailwind build can see them.
 */
export interface GuideAccent {
  /** Gradient chip behind the step number / icon. */
  chip: string;
  /** Accent-tinted text. */
  text: string;
  /** Horizontal fill gradient (progress bars). */
  fill: string;
  /** Vertical rail gradient drawn alongside a group's file entries. */
  rail: string;
  /** Soft tinted background for interactive chips (itinerary buttons). */
  soft: string;
}

const ACCENTS: GuideAccent[] = [
  {
    chip: 'bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-sm shadow-violet-500/30',
    text: 'text-violet-600 dark:text-violet-400',
    fill: 'bg-gradient-to-r from-violet-500 to-purple-500',
    rail: 'bg-gradient-to-b from-violet-500/50 via-violet-500/20 to-transparent',
    soft: 'bg-violet-500/10 hover:bg-violet-500/20',
  },
  {
    chip: 'bg-gradient-to-br from-sky-500 to-blue-600 text-white shadow-sm shadow-sky-500/30',
    text: 'text-sky-600 dark:text-sky-400',
    fill: 'bg-gradient-to-r from-sky-500 to-blue-500',
    rail: 'bg-gradient-to-b from-sky-500/50 via-sky-500/20 to-transparent',
    soft: 'bg-sky-500/10 hover:bg-sky-500/20',
  },
  {
    chip: 'bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-sm shadow-teal-500/30',
    text: 'text-teal-600 dark:text-teal-400',
    fill: 'bg-gradient-to-r from-teal-500 to-emerald-500',
    rail: 'bg-gradient-to-b from-teal-500/50 via-teal-500/20 to-transparent',
    soft: 'bg-teal-500/10 hover:bg-teal-500/20',
  },
  {
    chip: 'bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-sm shadow-amber-500/30',
    text: 'text-amber-600 dark:text-amber-400',
    fill: 'bg-gradient-to-r from-amber-500 to-orange-500',
    rail: 'bg-gradient-to-b from-amber-500/50 via-amber-500/20 to-transparent',
    soft: 'bg-amber-500/10 hover:bg-amber-500/20',
  },
  {
    chip: 'bg-gradient-to-br from-rose-500 to-pink-600 text-white shadow-sm shadow-rose-500/30',
    text: 'text-rose-600 dark:text-rose-400',
    fill: 'bg-gradient-to-r from-rose-500 to-pink-500',
    rail: 'bg-gradient-to-b from-rose-500/50 via-rose-500/20 to-transparent',
    soft: 'bg-rose-500/10 hover:bg-rose-500/20',
  },
];

const IMPLICIT_ACCENT: GuideAccent = {
  chip: 'bg-gradient-to-br from-zinc-400 to-zinc-500 text-white dark:from-zinc-600 dark:to-zinc-700 shadow-sm',
  text: 'text-muted-foreground',
  fill: 'bg-gradient-to-r from-zinc-400 to-zinc-500',
  rail: 'bg-gradient-to-b from-zinc-400/40 via-zinc-400/15 to-transparent',
  soft: 'bg-muted hover:bg-accent',
};

/** Accent for the group at `index` in display order. */
export function getGuideAccent(index: number, implicit = false): GuideAccent {
  if (implicit) return IMPLICIT_ACCENT;
  return ACCENTS[index % ACCENTS.length];
}
