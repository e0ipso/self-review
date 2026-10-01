import { parse as parseYaml } from 'yaml';

export interface FrontMatterResult {
  metadata: Record<string, unknown>;
  body: string;
  lineOffset: number;
}

/**
 * Extracts YAML front matter from markdown content.
 *
 * Front matter must start on the very first line with `---` and have a
 * matching closing `---`. Returns null if no valid front matter is found
 * or if the YAML between the delimiters is malformed.
 */
export function parseFrontMatter(content: string): FrontMatterResult | null {
  const lines = content.split('\n');

  if (lines.length === 0 || lines[0].trim() !== '---') {
    return null;
  }

  // Find closing delimiter
  let closingIndex = -1;
  for (let i = 1; i < lines.length; i++) {
    if (lines[i].trim() === '---') {
      closingIndex = i;
      break;
    }
  }

  if (closingIndex === -1) {
    return null;
  }

  const yamlContent = lines.slice(1, closingIndex).join('\n');

  try {
    const parsed = parseYaml(yamlContent);
    // YAML parsing of empty/whitespace content returns null
    const metadata: Record<string, unknown> =
      parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : {};

    const lineOffset = closingIndex + 1;
    const body = lines.slice(lineOffset).join('\n');

    return { metadata, body, lineOffset };
  } catch {
    return null;
  }
}

/**
 * Display budgets for front matter metadata. YAML anchors and aliases let a
 * few bytes describe a cyclic or very large structure (`loop: &loop [*loop]`
 * parses into an array that contains itself), so the table never walks the
 * parsed value directly. `buildFrontMatterDisplay` copies it into an acyclic
 * display tree first and gives up when any of these limits is crossed.
 *
 * - Depth 16: a top-level value is at depth 1. Real-world front matter is
 *   rarely more than three or four levels deep; 16 leaves ample headroom while
 *   keeping the recursive copy (and the nested tables it renders) shallow.
 * - 2,000 nodes: every value, scalar or container, counts once. That is far
 *   beyond any hand-written metadata block and small enough to render
 *   instantly. It also bounds shared (non-cyclic) aliases, which are expanded
 *   once per reference.
 */
export const FRONT_MATTER_MAX_DEPTH = 16;
export const FRONT_MATTER_MAX_NODES = 2000;

export type FrontMatterDisplayValue =
  | { kind: 'null' }
  | { kind: 'scalar'; text: string }
  | { kind: 'list'; items: FrontMatterDisplayValue[] }
  | { kind: 'map'; entries: FrontMatterDisplayEntry[] };

export type FrontMatterDisplayEntry = [key: string, value: FrontMatterDisplayValue];

export type FrontMatterLimitReason = 'cycle' | 'depth' | 'nodes';

export type FrontMatterDisplayResult =
  | { ok: true; entries: FrontMatterDisplayEntry[] }
  | { ok: false; reason: FrontMatterLimitReason };

class FrontMatterLimitExceeded extends Error {
  constructor(readonly reason: FrontMatterLimitReason) {
    super(`front matter exceeds display limits: ${reason}`);
  }
}

/**
 * Copies parsed front matter metadata into a bounded, acyclic display tree.
 *
 * Returns `{ ok: false }` instead of throwing when the metadata contains a
 * cycle or exceeds the depth or node budget, so callers can render a fallback
 * for this expected case. Cycle detection tracks the objects on the current
 * path only: a value reached twice through sibling aliases is legitimate and
 * is bounded by the node budget instead.
 */
export function buildFrontMatterDisplay(
  metadata: Record<string, unknown>
): FrontMatterDisplayResult {
  const ancestors = new WeakSet<object>();
  let nodes = 0;

  function toEntries(source: Record<string, unknown>, depth: number): FrontMatterDisplayEntry[] {
    return Object.entries(source).map(([key, value]) => [key, toDisplay(value, depth)]);
  }

  function toDisplay(value: unknown, depth: number): FrontMatterDisplayValue {
    if (depth > FRONT_MATTER_MAX_DEPTH) throw new FrontMatterLimitExceeded('depth');
    nodes += 1;
    if (nodes > FRONT_MATTER_MAX_NODES) throw new FrontMatterLimitExceeded('nodes');

    if (value === null) return { kind: 'null' };
    if (typeof value !== 'object') return { kind: 'scalar', text: String(value) };

    if (ancestors.has(value)) throw new FrontMatterLimitExceeded('cycle');
    ancestors.add(value);
    try {
      return Array.isArray(value)
        ? { kind: 'list', items: value.map(item => toDisplay(item, depth + 1)) }
        : { kind: 'map', entries: toEntries(value as Record<string, unknown>, depth + 1) };
    } finally {
      ancestors.delete(value);
    }
  }

  try {
    ancestors.add(metadata);
    return { ok: true, entries: toEntries(metadata, 1) };
  } catch (error) {
    if (error instanceof FrontMatterLimitExceeded) return { ok: false, reason: error.reason };
    throw error;
  }
}
