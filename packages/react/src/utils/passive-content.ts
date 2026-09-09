import { defaultUrlTransform, type UrlTransform } from 'react-markdown';
import type { Element, Root } from 'hast';

// Reviewed HTML may format text, but cannot create browsing contexts, forms,
// custom elements, SVG, or other active content. Keep positions for the gutter.
export const PASSIVE_HTML_TAGS: ReadonlySet<string> = new Set([
  'a',
  'abbr',
  'address',
  'article',
  'aside',
  'b',
  'bdi',
  'bdo',
  'blockquote',
  'br',
  'caption',
  'cite',
  'code',
  'col',
  'colgroup',
  'dd',
  'del',
  'details',
  'dfn',
  'div',
  'dl',
  'dt',
  'em',
  'figcaption',
  'figure',
  'footer',
  'h1',
  'h2',
  'h3',
  'h4',
  'h5',
  'h6',
  'header',
  'hr',
  'i',
  'img',
  'input',
  'ins',
  'kbd',
  'li',
  'main',
  'mark',
  'nav',
  'ol',
  'p',
  'pre',
  'q',
  'rp',
  'rt',
  'ruby',
  's',
  'samp',
  'section',
  'small',
  'span',
  'strong',
  'sub',
  'summary',
  'sup',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'time',
  'tr',
  'u',
  'ul',
  'var',
  'wbr',
]);

const GLOBAL_ATTRIBUTES = new Set(['className', 'title', 'lang', 'dir']);
const TAG_ATTRIBUTES: Record<string, ReadonlySet<string>> = {
  a: new Set(['href']),
  img: new Set(['src', 'alt', 'width', 'height']),
  input: new Set(['type', 'checked', 'disabled']),
  ol: new Set(['start', 'reversed']),
  li: new Set(['value']),
  td: new Set(['align', 'colSpan', 'rowSpan']),
  th: new Set(['align', 'colSpan', 'rowSpan', 'scope']),
  col: new Set(['span']),
  colgroup: new Set(['span']),
  details: new Set(['open']),
  time: new Set(['dateTime']),
};

export function isPassiveHtmlAttribute(tag: string, name: string): boolean {
  return GLOBAL_ATTRIBUTES.has(name) || TAG_ATTRIBUTES[tag]?.has(name) === true;
}

export function rehypePassiveContent() {
  return (tree: Root) => {
    function clean(parent: Root | Element): void {
      parent.children = parent.children.filter(node => {
        if (node.type !== 'element') return node.type === 'text';
        if (!PASSIVE_HTML_TAGS.has(node.tagName)) return false;
        for (const key of Object.keys(node.properties)) {
          if (!isPassiveHtmlAttribute(node.tagName, key)) delete node.properties[key];
        }
        // GFM task lists stay visible without allowing interactive form controls.
        if (node.tagName === 'input') {
          node.properties.type = 'checkbox';
          node.properties.disabled = true;
        }
        clean(node);
        return true;
      });
    }
    clean(tree);
  };
}

/** Resource URLs never get the network privileges of ordinary user links. */
export function isLocalImageUrl(url: string): boolean {
  const normalized = url.trim().replace(/[\t\r\n]/g, '');
  if (!normalized || normalized.startsWith('//') || normalized.includes('\\')) return false;
  if (
    /^data:image\/(?:png|jpeg|gif|webp|bmp|x-icon|vnd\.microsoft\.icon|svg\+xml)[;,]/i.test(
      normalized
    )
  )
    return true;
  if (/^blob:/i.test(normalized)) return true;
  return !/^[a-z][a-z\d+.-]*:/i.test(normalized);
}

export const localContentUrlTransform: UrlTransform = (url, key, node) => {
  if (node.tagName === 'a' && key === 'href') return defaultUrlTransform(url);
  if (node.tagName === 'img' && key === 'src' && isLocalImageUrl(url)) return url;
  return undefined;
};
