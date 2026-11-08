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
 * Display budgets. YAML aliases can describe cyclic or huge structures (`loop: &loop [*loop]`),
 * so the table walks an acyclic copy and gives up past these limits. Depth counts a top-level
 * value as 1; the node budget (every value counts once) also bounds shared aliases.
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
 * Returns `{ ok: false }` on a cycle or an exceeded budget. Cycle detection tracks only the
 * current path: a value reached twice through sibling aliases is legitimate.
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
