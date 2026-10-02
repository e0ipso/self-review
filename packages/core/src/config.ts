// YAML configuration loading and merging

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';
import { AppConfig } from './types';
import { DEFAULT_CONFIG } from '../../react/src/config-defaults';

// The defaults are shared with the renderer's ConfigProvider: one file, imported
// by relative source path, bundled into each package. See the header of
// packages/react/src/config-defaults.ts for why the file lives there.
const defaults: AppConfig = DEFAULT_CONFIG;

/**
 * Where a configuration value came from. The two files are trusted
 * differently: `~/.config/self-review/config.yaml` is the reviewer's own
 * (`user`), while `.self-review.yaml` in the launch directory is repository
 * data a project can commit (`project`). Hosts read this to decide whether
 * an `output-file` is the reviewer's explicit choice and whether
 * `default-diff-args` may name write-capable git options.
 */
export type ConfigValueOrigin = 'default' | 'user' | 'project';

export type ConfigProvenance = Readonly<Record<keyof AppConfig, ConfigValueOrigin>>;

export interface ConfigSource {
  origin: 'user' | 'project';
  /** The file that was read. */
  path: string;
}

export interface LoadedConfig {
  config: AppConfig;
  /** For each key, which of the two files set its value, or `default`. */
  provenance: ConfigProvenance;
  /** The files that were read and merged, in merge order. */
  sources: ConfigSource[];
}

export interface LoadConfigOptions {
  /** Where `.self-review.yaml` is looked for. Defaults to the process cwd. */
  cwd?: string;
  /** Where `.config/self-review/config.yaml` is looked for. Defaults to the home directory. */
  homeDir?: string;
}

const CONFIG_KEYS = Object.keys(defaults) as (keyof AppConfig)[];

/**
 * Load the merged configuration together with the origin of every value.
 * Project config overrides user config, which overrides the defaults; a
 * value a file set invalidly is not attributed to it, since the default is
 * what remains.
 */
export function loadConfigWithProvenance(options: LoadConfigOptions = {}): LoadedConfig {
  let config = { ...defaults };
  const provenance = Object.fromEntries(CONFIG_KEYS.map(key => [key, 'default'])) as Record<
    keyof AppConfig,
    ConfigValueOrigin
  >;
  // `guideFile` has no default, so it is not among the defaults' keys.
  provenance.guideFile = 'default';
  const sources: ConfigSource[] = [];

  const files: ConfigSource[] = [
    {
      origin: 'user',
      path: join(options.homeDir ?? homedir(), '.config', 'self-review', 'config.yaml'),
    },
    { origin: 'project', path: join(options.cwd ?? process.cwd(), '.self-review.yaml') },
  ];
  for (const source of files) {
    if (!existsSync(source.path)) continue;
    try {
      const override = loadYamlConfig(source.path);
      config = mergeConfig(config, override);
      for (const key of Object.keys(override) as (keyof AppConfig)[]) {
        provenance[key] = source.origin;
      }
      sources.push(source);
    } catch (error) {
      console.error(
        `Warning: Failed to load ${source.origin} config from ${source.path}: ${error}`
      );
    }
  }

  return { config, provenance, sources };
}

export function loadConfig(options: LoadConfigOptions = {}): AppConfig {
  return loadConfigWithProvenance(options).config;
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

  if ('font-size' in raw && typeof raw['font-size'] === 'number') {
    config.fontSize = raw['font-size'];
  }

  if ('output-format' in raw && typeof raw['output-format'] === 'string') {
    config.outputFormat = raw['output-format'];
  }

  if ('ignore' in raw && Array.isArray(raw.ignore)) {
    config.ignore = raw.ignore.filter((item: unknown) => typeof item === 'string');
  }

  if ('categories' in raw && Array.isArray(raw.categories)) {
    const usableCategories = raw.categories.filter(
      (cat: unknown): cat is { name: string; description: string; color: string } =>
        cat !== null &&
        typeof cat === 'object' &&
        typeof (cat as Record<string, unknown>).name === 'string' &&
        (cat as Record<string, unknown>).name !== '' &&
        typeof (cat as Record<string, unknown>).description === 'string' &&
        typeof (cat as Record<string, unknown>).color === 'string'
    );

    // A `categories` list that leaves no usable entry (empty list, every entry
    // shaped wrong, or every entry named '') would silently disable commenting,
    // so it's treated the same as any other invalid value: warn and keep the default.
    if (usableCategories.length > 0) {
      config.categories = usableCategories;
    } else {
      console.error(
        'Warning: Category configuration has no usable categories, using default categories'
      );
    }
  }

  if ('default-diff-args' in raw && typeof raw['default-diff-args'] === 'string') {
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
    config.maxTotalLines =
      raw['max-total-lines'] >= 0 ? raw['max-total-lines'] : defaults.maxTotalLines;
  }

  if (
    'output-file' in raw &&
    typeof raw['output-file'] === 'string' &&
    raw['output-file'].length > 0
  ) {
    config.outputFile = raw['output-file'];
  }

  if (
    'guide-file' in raw &&
    typeof raw['guide-file'] === 'string' &&
    raw['guide-file'].length > 0
  ) {
    config.guideFile = raw['guide-file'];
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
