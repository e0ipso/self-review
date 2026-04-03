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
