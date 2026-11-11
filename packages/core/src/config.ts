// YAML configuration loading and merging

import { existsSync } from 'fs';
import { readFileWithinBudgetSync } from './bounded-read';
import { join } from 'path';
import { homedir } from 'os';
import { parse as parseYaml } from 'yaml';
import { AppConfig } from './types';
import { stderrReporter, type DiagnosticReporter } from './diagnostics';
import { createDefaultConfig } from '../../config/src/index';

// Privately owned reference values, independent of the public compatibility snapshots.
const defaults = createDefaultConfig();

/**
 * `project` config is repository data and is trusted less than the reviewer's own `user` config.
 */
export type ConfigValueOrigin = 'default' | 'user' | 'project';

export type ConfigProvenance = Readonly<Record<keyof AppConfig, ConfigValueOrigin>>;

export interface ConfigSource {
  origin: 'user' | 'project';
  path: string;
}

export interface LoadedConfig {
  config: AppConfig;
  provenance: ConfigProvenance;
  sources: ConfigSource[];
}

export interface LoadConfigOptions {
  cwd?: string;
  homeDir?: string;
  /** Defaults to stderr; supply a callback to collect diagnostics without printing. */
  reportDiagnostic?: DiagnosticReporter;
}

/** Configuration is small startup input, bounded before YAML parsing. */
export const MAX_CONFIG_BYTES = 1024 * 1024;

const CONFIG_KEYS = Object.keys(defaults) as (keyof AppConfig)[];

/**
 * Project overrides user overrides defaults; an invalid value is not attributed to its file.
 * The deprecated `output-format` key is retained verbatim for compatibility. Publication always
 * produces XML. Unsupported values warn without rejecting the configuration or changing provenance.
 */
export function loadConfigWithProvenance(options: LoadConfigOptions = {}): LoadedConfig {
  const reportDiagnostic = options.reportDiagnostic ?? stderrReporter;
  let config = createDefaultConfig();
  const provenance = Object.fromEntries(CONFIG_KEYS.map(key => [key, 'default'])) as Record<
    keyof AppConfig,
    ConfigValueOrigin
  >;
  // `guideFile` has no default, so it is missing from CONFIG_KEYS.
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
      const override = loadYamlConfig(source.path, source.origin === 'project', reportDiagnostic);
      config = mergeConfig(config, override);
      for (const key of Object.keys(override) as (keyof AppConfig)[]) {
        provenance[key] = source.origin;
      }
      sources.push(source);
    } catch (error) {
      reportDiagnostic(
        `Warning: Failed to load ${source.origin} config from ${source.path}: ${error}`
      );
    }
  }

  return { config, provenance, sources };
}

/** Load merged configuration; `output-format` is deprecated and publication always uses XML. */
export function loadConfig(options: LoadConfigOptions = {}): AppConfig {
  return loadConfigWithProvenance(options).config;
}

function loadYamlConfig(
  path: string,
  noFollow: boolean,
  reportDiagnostic: DiagnosticReporter
): Partial<AppConfig> {
  // Project data cannot redirect startup reads through a link. User config may link
  // to another regular file, but the same byte and nonblocking limits apply.
  const read = readFileWithinBudgetSync(path, MAX_CONFIG_BYTES, { noFollow });
  if (read.kind === 'not-regular') throw new Error('Config is not a regular file');
  if (read.kind === 'too-large') {
    throw new Error(`Config exceeds the ${MAX_CONFIG_BYTES}-byte limit`);
  }
  const content = read.content.toString('utf-8');
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
      reportDiagnostic(`Warning: Invalid theme value "${raw.theme}", using default`);
    }
  }

  if ('diff-view' in raw) {
    if (['split', 'unified'].includes(raw['diff-view'])) {
      config.diffView = raw['diff-view'];
    } else {
      reportDiagnostic(`Warning: Invalid diff-view value "${raw['diff-view']}", using default`);
    }
  }

  if ('font-size' in raw && typeof raw['font-size'] === 'number') {
    config.fontSize = raw['font-size'];
  }

  if ('output-format' in raw && typeof raw['output-format'] === 'string') {
    config.outputFormat = raw['output-format'];
    if (config.outputFormat !== 'xml') {
      reportDiagnostic(
        'Warning: output-format is deprecated; only XML output is supported. The configured value is retained for compatibility.'
      );
    }
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
      reportDiagnostic(
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
