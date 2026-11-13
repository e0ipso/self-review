import { describe, it, expect } from 'vitest';
import Prism from 'prismjs';
import './svelte-grammar';

interface FlatToken {
  type: string;
  text: string;
  /** Token types enclosing this one, outermost first. */
  parents: string[];
}

function textOf(content: string | Prism.Token | (string | Prism.Token)[]): string {
  if (typeof content === 'string') return content;
  if (Array.isArray(content)) return content.map(textOf).join('');
  return textOf(content.content);
}

function flatten(stream: (string | Prism.Token)[], parents: string[] = []): FlatToken[] {
  return stream.flatMap(item => {
    if (typeof item === 'string') return [];
    const self = { type: item.type, text: textOf(item.content), parents };
    const children = Array.isArray(item.content)
      ? flatten(item.content, [...parents, item.type])
      : [];
    return [self, ...children];
  });
}

/** Tokenizes one line the way SyntaxLine does: one diff line at a time. */
function tokens(line: string): FlatToken[] {
  return flatten(Prism.tokenize(line, Prism.languages.svelte));
}

function pairs(line: string): [string, string][] {
  return tokens(line).map(t => [t.type, t.text]);
}

/** The keyword tokens that are direct children of a Svelte block tag. */
function blockKeywords(line: string): string[] {
  return tokens(line)
    .filter(t => t.type === 'keyword' && t.parents[t.parents.length - 1] === 'svelte-block')
    .map(t => t.text);
}

describe('svelte grammar', () => {
  it('registers Prism.languages.svelte', () => {
    expect(Prism.languages.svelte).toBeDefined();
  });

  it('tokenizes tags with brace-valued, quoted, shorthand and spread attributes', () => {
    const button = pairs('<button on:click={() => count++}>Click</button>');
    expect(button).toContainEqual(['tag', '<button on:click={() => count++}>']);
    expect(button).toContainEqual(['attr-name', 'on:click']);
    expect(button).toContainEqual(['namespace', 'on:']);
    expect(button).toContainEqual(['language-javascript', '{() => count++}']);
    expect(button).toContainEqual(['punctuation', '=']);
    expect(button.filter(([type, text]) => type === 'attr-name' && text.includes('='))).toEqual([]);

    const quoted = tokens('<div class="btn {active}">');
    expect(quoted).toContainEqual(
      expect.objectContaining({ type: 'attr-value', text: '="btn {active}"' })
    );
    expect(quoted).toContainEqual({
      type: 'language-javascript',
      text: '{active}',
      parents: ['tag', 'attr-value'],
    });
    expect(tokens('<a title="A &amp; B">')).toContainEqual(
      expect.objectContaining({ type: 'entity', text: '&amp;', parents: ['tag', 'attr-value'] })
    );

    // `=` inside a brace value belongs to the JavaScript, not to an attribute.
    const assignment = tokens('<button on:click={() => (name = "x")}>');
    expect(assignment.filter(t => t.type === 'attr-value')).toEqual([]);
    expect(assignment).toContainEqual(
      expect.objectContaining({
        type: 'string',
        text: '"x"',
        parents: ['tag', 'language-javascript'],
      })
    );

    expect(tokens('<input {value} />')).toContainEqual({
      type: 'language-javascript',
      text: '{value}',
      parents: ['tag'],
    });
    expect(tokens('<Component {...props} />')).toContainEqual({
      type: 'language-javascript',
      text: '{...props}',
      parents: ['tag'],
    });
  });

  it('tokenizes directive prefixes and svelte: special elements as namespaces', () => {
    const input = pairs('<input bind:value={name} class:active use:tooltip={opts} />');
    expect(input).toContainEqual(['namespace', 'bind:']);
    expect(input).toContainEqual(['namespace', 'class:']);
    expect(input).toContainEqual(['namespace', 'use:']);
    expect(input).toContainEqual(['attr-name', 'class:active']);

    for (const line of ['<svelte:head>', '</svelte:head>', '<svelte:window on:keydown={k} />']) {
      expect(tokens(line)).toContainEqual({
        type: 'namespace',
        text: 'svelte:',
        parents: ['tag', 'tag'],
      });
    }
  });

  it('highlights text interpolations as JavaScript, with one level of nested braces', () => {
    const line = pairs('<p>Clicked {count} times</p>');
    expect(line).toContainEqual(['language-javascript', '{count}']);
    expect(line).toContainEqual(['tag', '<p>']);
    expect(line).toContainEqual(['tag', '</p>']);

    expect(tokens('{fn({ a: 1 })}')[0]).toEqual({
      type: 'language-javascript',
      text: '{fn({ a: 1 })}',
      parents: [],
    });
  });

  it('tokenizes Svelte 4 block tags with the sigil and first word as the keyword', () => {
    const cases: [string, string[]][] = [
      ['{#if count > 10}', ['#if']],
      ['{:else}', [':else']],
      ['{/if}', ['/if']],
      ['{#each items as item, i (item.id)}', ['#each', 'as']],
      ['{/each}', ['/each']],
      ['{#await promise}', ['#await']],
      ['{:then value}', [':then']],
      ['{:catch error}', [':catch']],
      ['{/await}', ['/await']],
      ['{@html marked(text)}', ['@html']],
      ['{@debug user}', ['@debug']],
    ];
    for (const [line, keywords] of cases) {
      expect(pairs(line)[0], line).toEqual(['svelte-block', line]);
      expect(blockKeywords(line), line).toEqual(keywords);
    }

    // Only `:else` is Svelte's; `if x > 0` is the expression, highlighted as JavaScript.
    const elseIf = tokens('{:else if x > 0}');
    expect(blockKeywords('{:else if x > 0}')).toEqual([':else']);
    expect(elseIf).toContainEqual({
      type: 'language-javascript',
      text: ' if x > 0',
      parents: ['svelte-block'],
    });
    expect(elseIf).toContainEqual({
      type: 'keyword',
      text: 'if',
      parents: ['svelte-block', 'language-javascript'],
    });

    // A `<` in a block expression does not start a tag.
    expect(pairs('{#if a <b && c> d}').map(([type]) => type)).not.toContain('tag');
  });

  it('tokenizes Svelte 5 blocks and attachments with the same generic rule', () => {
    const cases: [string, string[]][] = [
      ['{#snippet row(item)}', ['#snippet']],
      ['{/snippet}', ['/snippet']],
      ['{@render row(item)}', ['@render']],
      ['{#key value}', ['#key']],
      ['{/key}', ['/key']],
      ['{@const total = a + b}', ['@const']],
    ];
    for (const [line, keywords] of cases) {
      expect(pairs(line)[0], line).toEqual(['svelte-block', line]);
      expect(blockKeywords(line), line).toEqual(keywords);
    }

    const attach = pairs('<div {@attach tooltip(text)}>');
    expect(attach).toContainEqual(['svelte-block', '{@attach tooltip(text)}']);
    expect(attach).toContainEqual(['keyword', '@attach']);
  });

  it('keeps HTML comments from markup', () => {
    expect(pairs('<!-- note {x} -->')).toEqual([['comment', '<!-- note {x} -->']]);
  });

  it('tokenizes a 2000-character brace-heavy line quickly', () => {
    const segments = ['{a}{b{c}}', '<x y={z}>', '{#if {', '<x a="{b" c={d '];
    let line = '';
    for (let i = 0; line.length < 2000; i++) line += segments[i % segments.length];
    line = line.slice(0, 2000);

    const start = performance.now();
    Prism.tokenize(line, Prism.languages.svelte);
    expect(performance.now() - start).toBeLessThan(100);
  });
});
