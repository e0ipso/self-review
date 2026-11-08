import { describe, expect, it } from 'vitest';
import type { Element, Root } from 'hast';
import { parsePassiveHtml, rehypePassiveContent } from './passive-content';

function elements(root: Root | Element, tagName: string): Element[] {
  const found: Element[] = [];
  for (const child of root.children) {
    if (child.type !== 'element') continue;
    if (child.tagName === tagName) found.push(child);
    found.push(...elements(child, tagName));
  }
  return found;
}

describe('passive content layout attributes', () => {
  it('drops class and style from reviewed HTML so it cannot reuse app positioning', () => {
    const tree = parsePassiveHtml(
      '<div class="fixed inset-0 z-50" style="position:fixed;inset:0">cover</div>' +
        '<p style="position: absolute; top: 0" class="absolute">text</p>'
    );
    const [div] = elements(tree, 'div');
    const [p] = elements(tree, 'p');
    expect(div.properties).not.toHaveProperty('className');
    expect(div.properties).not.toHaveProperty('style');
    expect(p.properties).not.toHaveProperty('className');
    expect(p.properties).not.toHaveProperty('style');
    expect(div.children[0]).toMatchObject({ type: 'text', value: 'cover' });
  });

  it('keeps only language-* class tokens, which code highlighting needs', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'pre',
          properties: { className: ['fixed'] },
          children: [
            {
              type: 'element',
              tagName: 'code',
              properties: { className: ['language-typescript', 'inset-0', 'sr-only'] },
              children: [{ type: 'text', value: 'const x = 1;' }],
            },
          ],
        },
      ],
    };
    rehypePassiveContent()(tree);
    const [pre] = elements(tree, 'pre');
    const [code] = elements(tree, 'code');
    expect(pre.properties).not.toHaveProperty('className');
    expect(code.properties.className).toEqual(['language-typescript']);
  });

  it('accepts a space-separated class string the same way', () => {
    const tree: Root = {
      type: 'root',
      children: [
        {
          type: 'element',
          tagName: 'code',
          properties: { className: 'language-mermaid absolute' },
          children: [],
        },
      ],
    };
    rehypePassiveContent()(tree);
    expect(elements(tree, 'code')[0].properties.className).toEqual(['language-mermaid']);
  });
});
