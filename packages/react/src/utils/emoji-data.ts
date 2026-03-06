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
      emoji.keywords.some((kw) => kw.includes(q));

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
  const emoji = emojis[shortcode];
  if (emoji) {
    return emoji.skins[0].native;
  }

  // Check aliases (e.g., "satisfied" -> "laughing")
  if (aliases) {
    const canonicalId = aliases[shortcode];
    if (canonicalId) {
      const aliasedEmoji = emojis[canonicalId];
      if (aliasedEmoji) {
        return aliasedEmoji.skins[0].native;
      }
    }
  }

  return null;
}
