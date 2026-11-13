/**
 * Prism grammar for Svelte component markup, registered as `Prism.languages.svelte`.
 *
 * It lives in-repo because Prism 1.x ships no Svelte grammar and no longer accepts new
 * languages, and the `prism-svelte` package is unmaintained: its block-tag rule never
 * matches and it predates Svelte 5. Diff lines are highlighted one at a time, so
 * `<script>` and `<style>` bodies stay plain; brace expressions are read as JavaScript.
 *
 * The tag/attribute rule is adapted from prism-svelte by pngwn (MIT).
 */
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-javascript';

/** A `{…}` expression with at most one level of nested braces; alternatives are disjoint. */
const BRACES = /\{(?:[^{}]|\{[^{}]*\})*\}/.source;

const QUOTED = /"[^"]*"|'[^']*'/.source;

/** An unquoted attribute value; never starts a brace expression. */
const UNQUOTED = /[^\s'">={}]+/.source;

/** One attribute: a bare `{…}` (shorthand, spread, attachment) or a name with an optional value. */
const ATTRIBUTE = `(?:${BRACES}|[^\\s>/={}]+(?:\\s*=\\s*(?:${QUOTED}|${BRACES}|${UNQUOTED}(?=[\\s>]))|(?=[\\s/>])))`;

const javascript = Prism.languages.javascript;

/** Markup's `&amp;` entity rule, also highlighted inside quoted attribute values (as markup does). */
const markupEntity = (Prism.languages.markup as Record<string, Prism.GrammarValue>).entity;

const expression: Prism.TokenObject = {
  pattern: new RegExp(BRACES),
  inside: javascript,
};

/**
 * Every block tag, current and future: `{` + sigil (`#`, `:`, `/`, `@`) + first word is the
 * keyword and the rest is JavaScript, so `{:else if x}` keeps `if x` as the expression. The
 * closing brace is optional so a block whose expression continues on the next line still
 * shows its keyword. Registered as `svelte-block`, not `block`: Prism renders the token type
 * as a class, and Tailwind's `.block` utility would make every block tag `display: block`.
 */
const block: Prism.TokenObject = {
  pattern: new RegExp(`\\{[#:/@][a-z]+\\b(?:[^{}]|\\{[^{}]*\\})*(?:\\}|$)`),
  inside: {
    keyword: [
      // `as` in `{#each items as item}`, matched against the whole block before any split.
      { pattern: /(^\{#each\b[\s\S]*?\s)as(?=\s)/, lookbehind: true },
      { pattern: /(^\{)[#:/@][a-z]+/, lookbehind: true },
    ],
    punctuation: /^\{|\}$/,
    'language-javascript': { pattern: /[\s\S]+/, inside: javascript },
  },
};

Prism.languages.svelte = Prism.languages.extend('markup', {
  tag: {
    pattern: new RegExp(`<\\/?(?!\\d)[^\\s>/=$<%{}]+(?:\\s(?:\\s*${ATTRIBUTE})+)?\\s*\\/?>`),
    greedy: true,
    inside: {
      tag: {
        pattern: /^<\/?[^\s>/]+/,
        inside: {
          punctuation: /^<\/?/,
          namespace: /^[^\s>/:]+:/,
        },
      },
      'svelte-block': block,
      'language-javascript': expression,
      'attr-value': {
        pattern: new RegExp(`=\\s*(?:${QUOTED}|${UNQUOTED})`),
        // Greedy so a quoted value reclaims any `{…}` the rule above already took out of it;
        // a quote inside a brace value starts inside a token and is left alone.
        greedy: true,
        inside: {
          punctuation: [
            { pattern: /^=/, alias: 'attr-equals' },
            { pattern: /^(\s*)["']|["']$/, lookbehind: true },
          ],
          'language-javascript': expression,
          entity: markupEntity,
        },
      },
      punctuation: [/\/?>/, { pattern: /=/, alias: 'attr-equals' }],
      'attr-name': {
        pattern: /[^\s>/={}]+/,
        inside: {
          namespace: /^[^\s>/:]+:/,
        },
      },
    },
  },
});

// Blocks and interpolations run before `tag`: a `<` inside an expression never starts a tag,
// and the greedy tag rule still reclaims an attribute's `{…}` that was taken out first.
Prism.languages.insertBefore('svelte', 'tag', {
  'svelte-block': block,
  'language-javascript': expression,
});
