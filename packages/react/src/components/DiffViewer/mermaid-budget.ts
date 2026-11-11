/** Conservative admission bounds, checked before Mermaid parses or measures any diagram. */
export const MERMAID_MAX_LAYOUT_CHARS = 8000;
export const MERMAID_MAX_STATEMENTS = 120;
export const MERMAID_MAX_TOKENS = 800;
export const MERMAID_MAX_NESTING = 12;
export const MERMAID_MAX_RELATION_WORK = 256;
export const MERMAID_MAX_EDGES = 64;

export function exceedsMermaidComplexity(code: string): boolean {
  if (code.length > MERMAID_MAX_LAYOUT_CHARS) return true;
  // Ignore punctuation in quoted labels, but bound every label before layout measurement.
  let quote = '',
    depth = 0,
    label = 0,
    stripped = '';
  for (let at = 0; at < code.length; at++) {
    const char = code[at];
    if (quote) {
      if (++label > 512) return true;
      if (char === '\\') {
        at++;
        stripped += '  ';
        continue;
      }
      if (char === quote) quote = '';
      stripped += ' ';
    } else if (char === '"' || char === "'" || char === '`') {
      quote = char;
      label = 0;
      stripped += ' ';
    } else {
      if ('([{'.includes(char)) {
        if (++depth > MERMAID_MAX_NESTING) return true;
      } else if (')]}'.includes(char)) depth = Math.max(0, depth - 1);
      stripped += char;
    }
  }
  const statements = stripped.split(/[;\n\r]/).filter(line => line.trim());
  if (statements.length > MERMAID_MAX_STATEMENTS) return true;
  let tokens = 0,
    relationWork = 0,
    blocks = 0;
  for (const line of statements) {
    if (line.length > 512) return true;
    if (/^\s*(subgraph|loop|alt|opt|par|critical|break|rect|box)\b/.test(line)) blocks++;
    else if (/^\s*end\b/.test(line)) blocks = Math.max(0, blocks - 1);
    if (blocks > MERMAID_MAX_NESTING) return true;
    const words = line.match(/[\p{L}\p{N}_]+|[^\s]/gu) ?? [];
    tokens += words.length;
    // Mermaid's grouped endpoints expand cartesian products. Counting arrows alone misses
    // `A & B & C --> D & E & F`. Charge the square of all endpoint/label words on that line.
    if (/[<>]|--|\.\.|==/.test(line)) {
      const identifiers = line.match(/[\p{L}\p{N}_]+/gu)?.length ?? 0;
      relationWork += Math.max(1, identifiers * identifiers);
    }
    if (tokens > MERMAID_MAX_TOKENS || relationWork > MERMAID_MAX_RELATION_WORK) return true;
  }
  return false;
}
