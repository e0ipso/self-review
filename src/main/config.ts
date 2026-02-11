// src/main/config.ts
// YAML configuration loading and merging

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';
import { AppConfig } from '../shared/types';

const defaults: AppConfig = {
  theme: 'system',
  diffView: 'split',
  prismTheme: 'one-dark',
  fontSize: 14,
  outputFormat: 'xml',
  ignore: [],
  categories: [],
  defaultDiffArgs: '',
};

export function loadConfig(): AppConfig {
  let config = { ...defaults };

  // Load user-level config
  const userConfigPath = join(homedir(), '.config', 'self-review', 'config.yaml');
  if (existsSync(userConfigPath)) {
    try {
      const userConfig = loadYamlConfig(userConfigPath);
      config = mergeConfig(config, userConfig);
    } catch (error) {
      console.error(`Warning: Failed to load user config from ${userConfigPath}: ${error}`);
    }
  }

  // Load project-level config
  const projectConfigPath = join(process.cwd(), '.self-review.yaml');
  if (existsSync(projectConfigPath)) {
    try {
      const projectConfig = loadYamlConfig(projectConfigPath);
      config = mergeConfig(config, projectConfig);
    } catch (error) {
      console.error(`Warning: Failed to load project config from ${projectConfigPath}: ${error}`);
    }
  }

  return config;
}

function loadYamlConfig(path: string): Partial<AppConfig> {
  const content = readFileSync(path, 'utf-8');
  const raw = parseYaml(content);

  if (!raw || typeof raw !== 'object') {
    throw new Error('Invalid YAML format');
  }

  // Map kebab-case keys to camelCase
  const config: Partial<AppConfig> = {};

  if ('theme' in raw) {
    if (['light', 'dark', 'system'].includes(raw.theme)) {
      config.theme = raw.theme;
    } else {
      console.error(`Warning: Invalid theme value "${raw.theme}", using default`);
    }
  }

  if ('diff-view' in raw) {
    if (['split', 'unified'].includes(raw['diff-view'])) {
      config.diffView = raw['diff-view'];
    } else {
      console.error(`Warning: Invalid diff-view value "${raw['diff-view']}", using default`);
    }
  }

  if ('prism-theme' in raw && typeof raw['prism-theme'] === 'string') {
    config.prismTheme = raw['prism-theme'];
  }

  if ('font-size' in raw && typeof raw['font-size'] === 'number') {
    config.fontSize = raw['font-size'];
  }

  if ('output-format' in raw && typeof raw['output-format'] === 'string') {
    config.outputFormat = raw['output-format'];
  }

  if ('ignore' in raw && Array.isArray(raw.ignore)) {
    config.ignore = raw.ignore.filter((item: any) => typeof item === 'string');
  }

  if ('categories' in raw && Array.isArray(raw.categories)) {
    config.categories = raw.categories.filter(
      (cat: any) =>
        cat &&
        typeof cat === 'object' &&
        typeof cat.name === 'string' &&
        typeof cat.description === 'string' &&
        typeof cat.color === 'string'
    );
  }

  if ('default-diff-args' in raw && typeof raw['default-diff-args'] === 'string') {
    config.defaultDiffArgs = raw['default-diff-args'];
  }

  return config;
}

function mergeConfig(base: AppConfig, override: Partial<AppConfig>): AppConfig {
  return {
    ...base,
    ...override,
    // Arrays are replaced, not merged
    ignore: override.ignore !== undefined ? override.ignore : base.ignore,
    categories: override.categories !== undefined ? override.categories : base.categories,
  };
}
