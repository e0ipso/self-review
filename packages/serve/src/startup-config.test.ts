import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { loadConfigWithProvenance } from '@self-review/core';
import { createStartupHost } from './startup-composition';

const loader = vi.hoisted(() => vi.fn());
vi.mock('./engine-contract', async importOriginal => {
  const original = await importOriginal<typeof import('./engine-contract')>();
  return {
    ...original,
    installedServeEngine: {
      ...original.installedServeEngine,
      core: { ...original.installedServeEngine.core, loadConfigWithProvenance: loader },
    },
  };
});

describe('installed-engine configuration normalization', () => {
  let directory: string;
  beforeEach(() => {
    vi.clearAllMocks();
    directory = mkdtempSync(join(tmpdir(), 'serve-config-'));
  });
  afterEach(() => rmSync(directory, { recursive: true, force: true }));

  function configured(fontSize: number) {
    const loaded = loadConfigWithProvenance({ cwd: directory, homeDir: directory });
    return {
      ...loaded,
      config: { ...loaded.config, fontSize },
      provenance: { ...loaded.provenance, fontSize: 'project' as const },
    };
  }

  it.each([NaN, Infinity, -Infinity])(
    'makes an older engine font size %s JSON-safe without changing the supplied value',
    fontSize => {
      const loaded = configured(fontSize);
      const fallback = configured(1).config;
      const expected = loadConfigWithProvenance({ cwd: directory, homeDir: directory }).config;
      loader.mockReturnValue(loaded);
      const report = vi.fn();
      const host = createStartupHost(directory, report);
      const options = { cwd: directory, homeDir: directory };
      const result = host.operations.loadConfigWithProvenance(options);
      expect(loader).toHaveBeenCalledWith(options);
      expect(result.config).toEqual({ ...fallback, fontSize: expected.fontSize });
      expect(result.provenance.fontSize).toBe('default');
      expect(result.sources).toBe(loaded.sources);
      expect(loaded.config.fontSize).toBe(fontSize);
      expect(loaded.provenance.fontSize).toBe('project');
      expect(JSON.parse(JSON.stringify(result.config)).fontSize).toBe(expected.fontSize);
      expect(report).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('font-size'));
    }
  );

  it.each([0, -18, 0.5, 999])('retains finite %s and its original provenance', fontSize => {
    const loaded = configured(fontSize);
    loader.mockReturnValue(loaded);
    const report = vi.fn();
    const result = createStartupHost(directory, report).operations.loadConfigWithProvenance();
    expect(result).toBe(loaded);
    expect(result.provenance.fontSize).toBe('project');
    expect(report).not.toHaveBeenCalled();
  });

  it('uses a per-call reporter without letting its failure change normalization', () => {
    loader.mockReturnValue(configured(Infinity));
    const hostReport = vi.fn();
    const reportDiagnostic = vi.fn(() => {
      throw new Error('Reporter unavailable');
    });
    const result = createStartupHost(directory, hostReport).operations.loadConfigWithProvenance({
      reportDiagnostic,
    });
    expect(Number.isFinite(result.config.fontSize)).toBe(true);
    expect(reportDiagnostic).toHaveBeenCalledExactlyOnceWith(expect.stringContaining('font-size'));
    expect(hostReport).not.toHaveBeenCalled();
  });
});
