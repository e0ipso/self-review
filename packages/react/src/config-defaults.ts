/**
 * The one source of the application's default configuration.
 *
 * Both halves of the program merge user input over these values: the Node-only
 * loader in `packages/core/src/config.ts` (YAML files) and the browser-side
 * `ConfigProvider` in `./context/ConfigContext.tsx` (an embedder's `config`
 * prop). Until they shared this file each kept its own copy, and the copies had
 * drifted — different category order, different `default-diff-args`, and an
 * ignore list the renderer did not know about.
 *
 * Where it lives, and why: this file is pure data with a type-only import, so
 * it is safe to bundle anywhere. It sits in `@self-review/react` because the
 * documented package boundaries allow exactly one direction for a shared
 * runtime value: React may import nothing from `@self-review/core` (core is
 * Node-only, and even one function risks dragging Node code into a browser
 * bundle), `@self-review/types` is type-only and ships no runtime, and a new
 * package was ruled out. Core therefore imports this file by relative source
 * path (`../../react/src/config-defaults`), the way the Electron app imports
 * package sources, and tsup inlines it into core's bundle — the published
 * `@self-review/core` does not depend on `@self-review/react` at runtime.
 *
 * Keep it free of imports other than types: anything added here is shipped to
 * browsers and to Node alike.
 */
import type { AppConfig, CategoryDef } from '@self-review/types';

/** Comment categories offered when neither YAML config nor an embedder names any. */
export const DEFAULT_CATEGORIES: readonly CategoryDef[] = [
  {
    name: 'question',
    description: 'Clarification needed — not necessarily a problem',
    color: '#805ad5',
  },
  {
    name: 'bug',
    description: 'Likely defect or incorrect behavior',
    color: '#e53e3e',
  },
  {
    name: 'security',
    description: 'Security vulnerability or concern',
    color: '#dd6b20',
  },
  {
    name: 'style',
    description: 'Code style, naming, or formatting issue',
    color: '#3182ce',
  },
  {
    name: 'task',
    description: 'Action item or follow-up task',
    color: '#38a169',
  },
  {
    name: 'nit',
    description: 'Minor nitpick, low priority',
    color: '#718096',
  },
];

/**
 * Paths a directory review skips when the YAML `ignore` key is unset:
 * version control, dependency and build output, virtual environments, and
 * generated lock or minified files. Only the Node-side directory scanner
 * consults these; the renderer carries them so the two defaults stay one.
 */
export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [
  '.git',
  'node_modules',
  'vendor',
  '.vendor',
  '__pycache__',
  '.venv',
  'venv',
  '.env',
  'dist',
  'build',
  '.next',
  '.nuxt',
  '.svelte-kit',
  'target',
  '*.min.js',
  '*.min.css',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'composer.lock',
  'Gemfile.lock',
  'Cargo.lock',
  'poetry.lock',
  'go.sum',
];

/** Diff code font size in CSS pixels (`font-size` YAML key). */
export const DEFAULT_FONT_SIZE = 14;

/** Large-payload thresholds (`max-files` / `max-total-lines` YAML keys). */
export const DEFAULT_MAX_FILES = 500;
export const DEFAULT_MAX_TOTAL_LINES = 100000;

/**
 * The complete default `AppConfig`. `guideFile` is deliberately absent: it has
 * no default, and the loader derives the guide path from the output path when
 * it is unset. Consumers spread this object rather than mutate it.
 */
export const DEFAULT_CONFIG: Readonly<AppConfig> = {
  theme: 'system',
  diffView: 'split',
  fontSize: DEFAULT_FONT_SIZE,
  outputFormat: 'xml',
  outputFile: './review.xml',
  ignore: [...DEFAULT_IGNORE_PATTERNS],
  categories: [...DEFAULT_CATEGORIES],
  defaultDiffArgs: '',
  showUntracked: true,
  showUntrackedExplicit: false,
  wordWrap: true,
  maxFiles: DEFAULT_MAX_FILES,
  maxTotalLines: DEFAULT_MAX_TOTAL_LINES,
};
