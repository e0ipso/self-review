// src/main/config.ts
// YAML configuration loading and merging

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';
import { AppConfig } from './types';

const defaults: AppConfig = {
  theme: 'system',
  diffView: 'split',
  fontSize: 14,
  outputFormat: 'xml',
  outputFile: './review.xml',
  ignore: [
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
  ],
  categories: [
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
  ],
  defaultDiffArgs: '',
  showUntracked: true,
  showUntrackedExplicit: false,
  wordWrap: true,
  maxFiles: 500,
  maxTotalLines: 100000,
};

export function loadConfig(): AppConfig {
  let config = { ...defaults };

  // Load user-level config
  const userConfigPath = join(
    homedir(),
    '.config',
    'self-review',
    'config.yaml'
  );
  if (existsSync(userConfigPath)) {
    try {
      const userConfig = loadYamlConfig(userConfigPath);
      config = mergeConfig(config, userConfig);
    } catch (error) {
      console.error(
        `Warning: Failed to load user config from ${userConfigPath}: ${error}`
      );
    }
  }

  // Load project-level config
  const projectConfigPath = join(process.cwd(), '.self-review.yaml');
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = loadYamlConfig(projectConfigPath);
      config = mergeConfig(config, projectConfig);
    } catch (error) {
      console.error(
        `Warning: Failed to load project config from ${projectConfigPath}: ${error}`
      );
    }
  }

  return config;
}

function loadYamlConfig(path: string): Partial<AppConfig> {
  const content = readFileSync(path, 'utf-8');
  const raw = parseYaml(content);

  // An empty file (or one containing only `null`) is a valid "use defaults" state.
  if (raw === null || raw === undefined) {
    return {};
  }

  if (typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Invalid YAML format');
  }

  // Map kebab-case keys to camelCase
  const config: Partial<AppConfig> = {};

  if ('theme' in raw) {
    if (['light', 'dark', 'system'].includes(raw.theme)) {
      config.theme = raw.theme;
    } else {
      console.error(
        `Warning: Invalid theme value "${raw.theme}", using default`
      );
    }
  }

  if ('diff-view' in raw) {
    if (['split', 'unified'].includes(raw['diff-view'])) {
      config.diffView = raw['diff-view'];
    } else {
      console.error(
        `Warning: Invalid diff-view value "${raw['diff-view']}", using default`
      );
    }
  }

  if ('font-size' in raw && typeof raw['font-size'] === 'number') {
    config.fontSize = raw['font-size'];
  }

  if ('output-format' in raw && typeof raw['output-format'] === 'string') {
    config.outputFormat = raw['output-format'];
  }

  if ('ignore' in raw && Array.isArray(raw.ignore)) {
    config.ignore = raw.ignore.filter(
      (item: unknown) => typeof item === 'string'
    );
  }

  if ('categories' in raw && Array.isArray(raw.categories)) {
    config.categories = raw.categories.filter(
      (cat: unknown): cat is { name: string; description: string; color: string } =>
        cat !== null &&
        typeof cat === 'object' &&
        typeof (cat as Record<string, unknown>).name === 'string' &&
        typeof (cat as Record<string, unknown>).description === 'string' &&
        typeof (cat as Record<string, unknown>).color === 'string'
    );
  }

  if (
    'default-diff-args' in raw &&
    typeof raw['default-diff-args'] === 'string'
  ) {
    config.defaultDiffArgs = raw['default-diff-args'];
  }

  if ('show-untracked' in raw && typeof raw['show-untracked'] === 'boolean') {
    config.showUntracked = raw['show-untracked'];
    config.showUntrackedExplicit = true;
  }

  if ('word-wrap' in raw && typeof raw['word-wrap'] === 'boolean') {
    config.wordWrap = raw['word-wrap'];
  }

  if ('max-files' in raw && typeof raw['max-files'] === 'number') {
    config.maxFiles = raw['max-files'] >= 0 ? raw['max-files'] : defaults.maxFiles;
  }

  if ('max-total-lines' in raw && typeof raw['max-total-lines'] === 'number') {
    config.maxTotalLines = raw['max-total-lines'] >= 0 ? raw['max-total-lines'] : defaults.maxTotalLines;
  }

  if (
    'output-file' in raw &&
    typeof raw['output-file'] === 'string' &&
    raw['output-file'].length > 0
  ) {
    config.outputFile = raw['output-file'];
  }

  return config;
}

function mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...override,
    // Arrays are replaced, not merged
    ignore: override.ignore !== undefined ? override.ignore : base.ignore,
    categories:
      override.categories !== undefined ? override.categories : base.categories,
  };
}
