declare module '*.css?raw' {
  const content: string;
  export default content;
}

// @emoji-mart/data ships types for its interfaces but no default export.
// The package main is a JSON file (sets/15/native.json) that webpack resolves.
declare module '@emoji-mart/data' {
  interface Emoji {
    id: string;
    name: string;
    keywords: string[];
    skins: { unified: string; native: string }[];
    version: number;
    emoticons?: string[];
  }

  interface EmojiMartData {
    categories: { id: string; emojis: string[] }[];
    emojis: Record<string, Emoji>;
    aliases: Record<string, string>;
    sheet: { cols: number; rows: number };
  }

  const data: EmojiMartData;
  export default data;
  export type { Emoji, EmojiMartData };
}
