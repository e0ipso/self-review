import { describe, it, expect } from 'vitest';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkStringify from 'remark-stringify';
import { remarkEmoji } from './remark-emoji';

async function processMarkdown(input: string): Promise<string> {
  const result = await unified()
    .use(remarkParse)
    .use(remarkEmoji)
    .use(remarkStringify)
    .process(input);
  return String(result);
}

describe('remarkEmoji', () => {
  it('replaces valid shortcodes with Unicode emojis', async () => {
    const result = await processMarkdown('Hello :rocket: world');
    expect(result).toContain('🚀');
    expect(result).not.toContain(':rocket:');
  });

  it('leaves invalid shortcodes as-is', async () => {
    const result = await processMarkdown('Hello :notanemoji: world');
    expect(result).toContain(':notanemoji:');
  });

  it('does not replace shortcodes in inline code', async () => {
    const result = await processMarkdown('Hello `code :rocket: here` world');
    expect(result).toContain(':rocket:');
  });

  it('does not replace shortcodes in fenced code blocks', async () => {
    const result = await processMarkdown('```\n:rocket:\n```');
    expect(result).toContain(':rocket:');
  });

  it('replaces multiple shortcodes in the same line', async () => {
    const result = await processMarkdown(':rocket: and :heart:');
    expect(result).toContain('🚀');
    expect(result).toContain('❤️');
    expect(result).not.toContain(':rocket:');
    expect(result).not.toContain(':heart:');
  });
});
