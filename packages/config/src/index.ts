import type { AppConfig, CategoryDef } from '@self-review/types';

const categoryTemplate: readonly Readonly<CategoryDef>[] = Object.freeze(
  [
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
  ].map(category => Object.freeze(category))
);

/** Only core's directory scanner reads these; the renderer carries them so the defaults stay one. */
const ignoreTemplate: readonly string[] = Object.freeze([
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
]);

export const DEFAULT_FONT_SIZE = 14;

export const DEFAULT_MAX_FILES = 500;
export const DEFAULT_MAX_TOTAL_LINES = 100000;

/** `guideFile` is absent on purpose: the loader derives it from the output path. */
const configTemplate = Object.freeze({
  theme: 'system',
  diffView: 'split',
  fontSize: DEFAULT_FONT_SIZE,
  outputFormat: 'xml',
  outputFile: './review.xml',
  ignore: ignoreTemplate,
  categories: categoryTemplate,
  defaultDiffArgs: '',
  showUntracked: true,
  showUntrackedExplicit: false,
  wordWrap: true,
  maxFiles: DEFAULT_MAX_FILES,
  maxTotalLines: DEFAULT_MAX_TOTAL_LINES,
} satisfies Omit<AppConfig, 'ignore' | 'categories'> & {
  ignore: readonly string[];
  categories: readonly Readonly<CategoryDef>[];
});

/** Return mutable defaults with independently owned arrays and category objects. */
export function createDefaultConfig(): AppConfig {
  return {
    ...configTemplate,
    ignore: [...configTemplate.ignore],
    categories: configTemplate.categories.map(category => ({ ...category })),
  };
}

/** Copy caller-owned nested configuration before retaining it. */
export function cloneConfig(config: AppConfig): AppConfig {
  return {
    ...config,
    // Partial configuration can explicitly replace a default with undefined.
    ignore: config.ignore && [...config.ignore],
    categories: config.categories && config.categories.map(category => ({ ...category })),
  };
}

// Compatibility snapshots remain mutable at runtime. Internal factories never read them.
export const DEFAULT_CATEGORIES: readonly CategoryDef[] = categoryTemplate.map(category => ({
  ...category,
}));
export const DEFAULT_IGNORE_PATTERNS: readonly string[] = [...ignoreTemplate];
export const DEFAULT_CONFIG: Readonly<AppConfig> = createDefaultConfig();
