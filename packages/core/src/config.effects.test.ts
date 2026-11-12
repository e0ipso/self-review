import { describe, expect, it, vi } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { createDefaultConfig } from '../../config/src/index';
import {
  loadConfig,
  loadConfigWithProvenance,
  MAX_CONFIG_BYTES,
  type ConfigEffects,
} from './config';
import { normalizeConfigFontSize } from './config-font-size';

function virtualFiles(user?: string, project?: string): ConfigEffects {
  const files = new Map([
    ['/virtual/home/.config/self-review/config.yaml', user],
    ['/virtual/project/.self-review.yaml', project],
  ]);
  return {
    exists: path => files.get(path) !== undefined,
    read: (path, maxBytes, options) => {
      expect(maxBytes).toBe(MAX_CONFIG_BYTES);
      expect(options.noFollow).toBe(path.endsWith('.self-review.yaml'));
      const content = files.get(path);
      if (content === undefined) throw new Error('Virtual file missing');
      return { kind: 'ok', content: Buffer.from(content) };
    },
    homeDir: () => '/virtual/home',
    cwd: () => '/virtual/project',
  };
}

describe('explicit configuration effects', () => {
  it('uses virtual locations and inputs with real YAML parsing and precedence', () => {
    const effects = virtualFiles('theme: dark\nfont-size: 16\n', 'diff-view: unified\n');
    const loaded = loadConfigWithProvenance({ effects });
    expect(loaded.config).toMatchObject({ theme: 'dark', fontSize: 16, diffView: 'unified' });
    expect(loaded.provenance).toMatchObject({
      theme: 'user',
      fontSize: 'user',
      diffView: 'project',
    });
    expect(loaded.sources.map(source => source.path)).toEqual([
      '/virtual/home/.config/self-review/config.yaml',
      '/virtual/project/.self-review.yaml',
    ]);
  });

  it('does not fall back to existing native files after a custom read fails or reports absent', () => {
    const root = mkdtempSync(join(tmpdir(), 'config-effects-'));
    try {
      writeFileSync(join(root, '.self-review.yaml'), 'font-size: 123\n');
      const effects = virtualFiles();
      effects.exists = () => true;
      effects.read = () => {
        throw new Error('virtual refusal');
      };
      const reportDiagnostic = vi.fn();
      const loaded = loadConfigWithProvenance({ cwd: root, effects, reportDiagnostic });
      expect(loaded.config.fontSize).toBe(createDefaultConfig().fontSize);
      expect(loaded.sources).toEqual([]);
      expect(reportDiagnostic).toHaveBeenCalledWith(expect.stringContaining('virtual refusal'));
      effects.exists = () => false;
      expect(loadConfig({ cwd: root, effects })).toEqual(createDefaultConfig());
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it('matches default native reads, explicit locations and diagnostic results', () => {
    const root = mkdtempSync(join(tmpdir(), 'config-parity-'));
    try {
      mkdirSync(join(root, '.config/self-review'), { recursive: true });
      const user = 'theme: dark\nfont-size: 17\n';
      const project = 'diff-view: unified\noutput-format: json\n';
      writeFileSync(join(root, '.config/self-review/config.yaml'), user);
      writeFileSync(join(root, '.self-review.yaml'), project);
      const diagnostics: string[] = [];
      const native = loadConfigWithProvenance({
        cwd: root,
        homeDir: root,
        reportDiagnostic: message => diagnostics.push(message),
      });
      const virtualDiagnostics: string[] = [];
      const virtual = loadConfigWithProvenance({
        effects: virtualFiles(user, project),
        reportDiagnostic: message => virtualDiagnostics.push(message),
      });
      expect(virtual.config).toEqual(native.config);
      expect(virtual.provenance).toEqual(native.provenance);
      expect(virtualDiagnostics).toEqual(diagnostics);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});

describe('finite YAML font sizes', () => {
  it.each(['.nan', '.inf', '-.inf'])('rejects native YAML %s before JSON transport', value => {
    const root = mkdtempSync(join(tmpdir(), 'config-font-'));
    try {
      mkdirSync(join(root, '.config/self-review'), { recursive: true });
      writeFileSync(join(root, '.config/self-review/config.yaml'), 'font-size: 19\n');
      writeFileSync(join(root, '.self-review.yaml'), `font-size: ${value}\n`);
      const reportDiagnostic = vi.fn();
      const loaded = loadConfigWithProvenance({ cwd: root, homeDir: root, reportDiagnostic });
      expect(loaded.config.fontSize).toBe(19);
      expect(loaded.provenance.fontSize).toBe('user');
      expect(JSON.parse(JSON.stringify(loaded.config)).fontSize).toBe(19);
      expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('Invalid font-size')
      );
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it.each(['.nan', '.inf', '-.inf'])(
    'retains the user value when project font-size is %s',
    value => {
      const reportDiagnostic = vi.fn();
      const loaded = loadConfigWithProvenance({
        effects: virtualFiles('font-size: 19\n', `font-size: ${value}\n`),
        reportDiagnostic,
      });
      expect(loaded.config.fontSize).toBe(19);
      expect(loaded.provenance.fontSize).toBe('user');
      expect(JSON.parse(JSON.stringify(loaded.config)).fontSize).toBe(19);
      expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(
        expect.stringContaining('Invalid font-size')
      );
    }
  );

  it.each(['.nan', '.inf', '-.inf'])('keeps fresh defaults when only %s is configured', value => {
    const loaded = loadConfigWithProvenance({
      effects: virtualFiles(`font-size: ${value}\n`),
      reportDiagnostic: () => {},
    });
    expect(loaded.config.fontSize).toBe(createDefaultConfig().fontSize);
    expect(loaded.provenance.fontSize).toBe('default');
    expect(JSON.parse(JSON.stringify(loaded.config)).fontSize).toBe(loaded.config.fontSize);
  });

  it.each([-100, 0, 0.5, 18, 1e100])(
    'preserves finite font-size %s and project precedence',
    value => {
      const reportDiagnostic = vi.fn();
      const loaded = loadConfigWithProvenance({
        effects: virtualFiles('font-size: 19\n', `font-size: ${value}\n`),
        reportDiagnostic,
      });
      expect(loaded.config.fontSize).toBe(value);
      expect(loaded.provenance.fontSize).toBe('project');
      expect(reportDiagnostic).not.toHaveBeenCalled();
    }
  );

  it('normalizes an older engine config without mutating it or losing unrelated fields', () => {
    const legacy = { ...createDefaultConfig(), fontSize: Infinity, guideFile: 'guide.xml' };
    const normalized = normalizeConfigFontSize(legacy);
    expect(normalized.config).toEqual({ ...legacy, fontSize: createDefaultConfig().fontSize });
    expect(normalized.diagnostic).toContain('Invalid font-size');
    expect(legacy.fontSize).toBe(Infinity);
    expect(normalizeConfigFontSize(normalized.config, 14)).toEqual({ config: normalized.config });
  });
});
