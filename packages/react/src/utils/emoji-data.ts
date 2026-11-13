import type { Emoji } from '@emoji-mart/data';
import data from '@emoji-mart/data';

export interface EmojiMatch {
  id: string;
  name: string;
  native: string;
}

const emojis: Record<string, Emoji> = data.emojis;
const aliases: Record<string, string> = data.aliases;

const MAX_RESULTS = 8;

export function searchEmojis(query: string): EmojiMatch[] {
  if (!query) return [];

  const q = query.toLowerCase();
  const results: EmojiMatch[] = [];

  for (const emoji of Object.values(emojis)) {
    if (results.length >= MAX_RESULTS) break;

    const matches =
      emoji.id.startsWith(q) ||
      emoji.name.toLowerCase().includes(q) ||
      emoji.keywords.some(kw => kw.includes(q));

    if (matches) {
      results.push({
        id: emoji.id,
        name: emoji.name,
        native: emoji.skins[0].native,
      });
    }
  }

  return results;
}

export function resolveShortcode(shortcode: string): string | null {
  if (Object.prototype.hasOwnProperty.call(emojis, shortcode))
    return emojis[shortcode].skins[0].native;

  const canonicalId = Object.prototype.hasOwnProperty.call(aliases, shortcode)
    ? aliases[shortcode]
    : null;
  return canonicalId && Object.prototype.hasOwnProperty.call(emojis, canonicalId)
    ? emojis[canonicalId].skins[0].native
    : null;
}
