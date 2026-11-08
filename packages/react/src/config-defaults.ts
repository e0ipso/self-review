/**
 * Default `AppConfig`, shared by core's YAML loader and `ConfigProvider`. It lives in react
 * because react may not import core; core imports it by relative path. Type-only imports only,
 * since it ships to browsers and Node alike.
 */
import type { AppConfig, CategoryDef } from '@self-review/types';

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

/** Only core's directory scanner reads these; the renderer carries them so the defaults stay one. */
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

export const DEFAULT_FONT_SIZE = 14;

export const DEFAULT_MAX_FILES = 500;
export const DEFAULT_MAX_TOTAL_LINES = 100000;

/** `guideFile` is absent on purpose: the loader derives it from the output path. */
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
