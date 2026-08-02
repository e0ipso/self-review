import React from 'react';
import type { ResolvedGuideGroup } from '@self-review/types';

export interface GuideRouteMapProps {
  groups: ResolvedGuideGroup[];
  /** True when every file in the group has been marked viewed. */
  isGroupComplete: (group: ResolvedGuideGroup) => boolean;
  /** Scroll the review to a file; stations jump to their group's first file. */
  onJump?: (filePath: string) => void;
}

const W = 960;
const H = 200;
const PAD_X = 72;
const Y_HIGH = 74;
const Y_LOW = 122;

/** Truncate a station label to keep neighbors readable. */
function clip(name: string, max = 18): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

/**
 * The walkthrough drawn as a winding route: one station per guide group,
 * connected in reading order, alternating above and below the path's
 * midline. Station size scales with the group's file count, stations fill
 * solid once their group is fully reviewed, and the implicit "Everything
 * else" group hangs off the end of the route on a dashed segment.
 *
 * Pure SVG in a fixed viewBox so it scales with its container; all colors
 * come from theme classes so light and dark both work.
 */
export function GuideRouteMap({
  groups,
  isGroupComplete,
  onJump,
}: GuideRouteMapProps) {
  const n = groups.length;
  if (n === 0) return null;

  const points = groups.map((group, i) => ({
    x: n === 1 ? W / 2 : PAD_X + (i * (W - 2 * PAD_X)) / (n - 1),
    y: n === 1 ? (Y_HIGH + Y_LOW) / 2 : i % 2 === 0 ? Y_HIGH : Y_LOW,
    r: 11 + Math.min(6, Math.max(0, group.files.length - 1) * 1.5),
  }));

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role='img'
      aria-label='Walkthrough route map'
      className='h-auto w-full select-none'
      style={{ maxHeight: 220 }}
    >
      {/* Route segments, drawn beneath the stations. */}
      {points.map((p, i) => {
        if (i === 0) return null;
        const prev = points[i - 1];
        const dx = (p.x - prev.x) * 0.45;
        const dashed = groups[i].implicit;
        return (
          <path
            key={`segment-${i}`}
            d={`M ${prev.x} ${prev.y} C ${prev.x + dx} ${prev.y}, ${p.x - dx} ${p.y}, ${p.x} ${p.y}`}
            fill='none'
            strokeWidth={2.5}
            strokeLinecap='round'
            strokeDasharray={dashed ? '2 7' : undefined}
            className={
              dashed
                ? 'stroke-muted-foreground/50'
                : 'stroke-indigo-500/45 dark:stroke-indigo-400/45'
            }
          />
        );
      })}

      {groups.map((group, i) => {
        const p = points[i];
        const complete = isGroupComplete(group);
        const firstFilePath = group.files[0]?.path;
        const labelAbove = p.y === Y_LOW && n > 1;
        // Above-station labels stack upward: name on top, count beneath it,
        // both clear of the circle.
        const labelY = labelAbove ? p.y - p.r - 26 : p.y + p.r + 18;
        const station = (
          <g
            key={`station-${i}-${group.name}`}
            onClick={
              onJump && firstFilePath ? () => onJump(firstFilePath) : undefined
            }
            className={onJump && firstFilePath ? 'cursor-pointer' : undefined}
          >
            {group.rationale && <title>{group.rationale}</title>}
            <circle
              cx={p.x}
              cy={p.y}
              r={p.r}
              strokeWidth={2.5}
              strokeDasharray={group.implicit ? '3 3' : undefined}
              className={
                group.implicit
                  ? `stroke-muted-foreground/60 ${complete ? 'fill-muted-foreground/60' : 'fill-background'}`
                  : `stroke-indigo-500 dark:stroke-indigo-400 ${
                      complete
                        ? 'fill-indigo-500 dark:fill-indigo-400'
                        : 'fill-background'
                    }`
              }
            />
            {!group.implicit && (
              <text
                x={p.x}
                y={p.y + 3.5}
                textAnchor='middle'
                fontSize={11}
                fontWeight={600}
                className={
                  complete
                    ? 'fill-white'
                    : 'fill-indigo-600 dark:fill-indigo-400'
                }
              >
                {complete ? '✓' : i + 1}
              </text>
            )}
            <text
              x={p.x}
              y={labelY}
              textAnchor='middle'
              fontSize={13}
              fontWeight={600}
              className='fill-foreground'
            >
              {clip(group.name)}
            </text>
            <text
              x={p.x}
              y={labelY + 15}
              textAnchor='middle'
              fontSize={10.5}
              fontFamily='ui-monospace, monospace'
              className='fill-muted-foreground'
            >
              {group.files.length} {group.files.length === 1 ? 'file' : 'files'}
            </text>
          </g>
        );
        return station;
      })}
    </svg>
  );
}
