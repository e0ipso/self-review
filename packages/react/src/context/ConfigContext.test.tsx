import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, act } from '@testing-library/react';
import type { AppConfig, CategoryDef } from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();

import {
  ConfigProvider,
  useConfig,
  defaultConfig,
  useAppearance,
  useCategories,
  useOutputPath,
  usePortalContainer,
  useConfiguration,
  type ConfigContextValue,
} from './ConfigContext';
import { DEFAULT_CONFIG } from '../config-defaults';

describe('ConfigProvider defaults', () => {
  it('uses the shared default configuration, the same one the Node loader merges over', () => {
    expect(defaultConfig).toBe(DEFAULT_CONFIG);
  });
});

function CategoriesProbe() {
  const { config } = useConfig();
  return (
    <ul data-testid='categories-probe'>
      {config.categories.map((cat, index) => (
        <li key={index}>{cat.name}</li>
      ))}
    </ul>
  );
}

function renderWithConfig(initialConfig?: { categories: CategoryDef[] }) {
  return render(
    <ConfigProvider initialConfig={initialConfig}>
      <CategoriesProbe />
    </ConfigProvider>
  );
}

function probeNames(): string[] {
  return Array.from(screen.getByTestId('categories-probe').querySelectorAll('li')).map(
    li => li.textContent
  );
}

const defaultNames = defaultConfig.categories.map(c => c.name);

describe('ConfigProvider category fallback', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('keeps the built-in categories when the embedder does not override them', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithConfig();

    expect(probeNames()).toEqual(defaultNames);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('keeps a valid embedder-supplied categories list unaffected', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const custom: CategoryDef[] = [
      { name: 'custom', description: 'A custom category', color: '#123456' },
    ];

    renderWithConfig({ categories: custom });

    expect(probeNames()).toEqual(['custom']);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('falls back to defaults and warns when given an empty categories list', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithConfig({ categories: [] });

    expect(probeNames()).toEqual(defaultNames);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no usable categories'));
  });

  it('falls back to defaults and warns when every category has a blank name', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithConfig({
      categories: [
        { name: '', description: 'Nameless', color: '#ff0000' },
        { name: '   ', description: 'Whitespace name', color: '#00ff00' },
      ],
    });

    expect(probeNames()).toEqual(defaultNames);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no usable categories'));
  });

  it('keeps a mixed list that has at least one usable category, without warning', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithConfig({
      categories: [
        { name: '', description: 'Nameless', color: '#ff0000' },
        { name: 'keep-me', description: 'Real category', color: '#00ff00' },
      ],
    });

    expect(probeNames()).toEqual(['', 'keep-me']);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('does not re-log the warning on unrelated re-renders', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { rerender } = render(
      <ConfigProvider initialConfig={{ categories: [] }}>
        <CategoriesProbe />
      </ConfigProvider>
    );
    rerender(
      <ConfigProvider initialConfig={{ categories: [] }}>
        <CategoriesProbe />
      </ConfigProvider>
    );

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });
});

describe('ConfigProvider font size', () => {
  function rootStyle(fontSize: number) {
    const { container } = render(
      <ConfigProvider initialConfig={{ fontSize }}>
        <span />
      </ConfigProvider>
    );
    return (container.querySelector('.self-review') as HTMLElement).style;
  }

  it('exposes the configured font-size as a CSS variable on the review root', () => {
    expect(rootStyle(18).getPropertyValue('--sr-font-size')).toBe('18px');
  });

  it('falls back to the default size for a value that is not a positive finite number', () => {
    const fallback = `${defaultConfig.fontSize}px`;
    expect(rootStyle(0).getPropertyValue('--sr-font-size')).toBe(fallback);
    expect(rootStyle(Number.NaN).getPropertyValue('--sr-font-size')).toBe(fallback);
  });
});

// These probes observe ownership through the supported mutable configuration and setter APIs.
describe('configuration ownership and subscriptions', () => {
  it('owns nested values across providers, including caller-supplied values', () => {
    const values: ConfigContextValue[] = [];
    const supplied = {
      ignore: ['custom'],
      categories: [{ name: 'custom', description: '', color: '#000' }],
    };
    function Probe({ index }: { index: number }) {
      values[index] = useConfig();
      return null;
    }
    render(
      <>
        <ConfigProvider>
          <Probe index={0} />
        </ConfigProvider>
        <ConfigProvider>
          <Probe index={1} />
        </ConfigProvider>
        <ConfigProvider initialConfig={supplied}>
          <Probe index={2} />
        </ConfigProvider>
      </>
    );
    const originalName = defaultConfig.categories[0].name;
    const originalIgnoreLength = defaultConfig.ignore.length;
    try {
      values[0].config.ignore.push('one-only');
      values[0].config.categories[0].name = 'one-only';
      values[2].config.ignore.push('owned');
      values[2].config.categories[0].name = 'owned';
      expect(values[1].config.categories[0].name).toBe(originalName);
      expect(values[1].config.ignore).not.toContain('one-only');
      expect(supplied.ignore).toEqual(['custom']);
      expect(supplied.categories[0].name).toBe('custom');
    } finally {
      defaultConfig.categories[0].name = originalName;
      defaultConfig.ignore.splice(originalIgnoreLength);
    }
  });

  it('retains independent nested values on both mutation call forms', () => {
    let value!: ConfigContextValue;
    function Probe() {
      value = useConfig();
      return null;
    }
    render(
      <ConfigProvider>
        <Probe />
      </ConfigProvider>
    );
    const replacement: AppConfig = {
      ...defaultConfig,
      ignore: ['replace'],
      categories: [{ name: 'replace', description: '', color: '#000' }],
    };
    act(() => value.setConfig(replacement));
    replacement.ignore.push('late');
    replacement.categories[0].name = 'late';
    expect(value.config.ignore).toEqual(['replace']);
    expect(value.config.categories[0].name).toBe('replace');
    const updates = {
      ignore: ['update'],
      categories: [{ name: 'update', description: '', color: '#000' }],
    };
    act(() => value.updateConfig(updates));
    updates.ignore.push('late');
    updates.categories[0].name = 'late';
    expect(value.config.ignore).toEqual(['update']);
    expect(value.config.categories[0].name).toBe('update');
  });

  it('preserves explicitly unset partial values and functional setter calls', () => {
    let value!: ConfigContextValue;
    function Probe() {
      value = useConfig();
      return null;
    }
    render(
      <ConfigProvider initialConfig={{ ignore: undefined }}>
        <Probe />
      </ConfigProvider>
    );
    expect(value.config.ignore).toBeUndefined();
    const setter = value.setConfig as React.Dispatch<React.SetStateAction<AppConfig>>;
    act(() => setter(previous => ({ ...previous, theme: 'dark' })));
    expect(value.config.theme).toBe('dark');
    expect(value.config.ignore).toBeUndefined();
  });

  it('keeps initial configuration semantics and preserves user edits on rerender', () => {
    let value!: ConfigContextValue;
    function Probe() {
      value = useConfig();
      return null;
    }
    const { rerender } = render(
      <ConfigProvider initialConfig={{ theme: 'light' }}>
        <Probe />
      </ConfigProvider>
    );
    act(() => value.updateConfig({ wordWrap: false }));
    rerender(
      <ConfigProvider initialConfig={{ theme: 'dark', wordWrap: true }}>
        <Probe />
      </ConfigProvider>
    );
    expect(value.config.theme).toBe('light');
    expect(value.config.wordWrap).toBe(false);
  });

  it('only invalidates the focused subscriptions affected by an update', () => {
    let value!: ConfigContextValue;
    const counts = { appearance: 0, categories: 0, output: 0, portal: 0, configuration: 0 };
    function Legacy() {
      value = useConfig();
      return null;
    }
    function Appearance() {
      useAppearance();
      counts.appearance++;
      return null;
    }
    function Categories() {
      useCategories();
      counts.categories++;
      return null;
    }
    function Output() {
      useOutputPath();
      counts.output++;
      return null;
    }
    function Portal() {
      usePortalContainer();
      counts.portal++;
      return null;
    }
    function Configuration() {
      useConfiguration();
      counts.configuration++;
      return null;
    }
    render(
      <ConfigProvider>
        <Legacy />
        <Appearance />
        <Categories />
        <Output />
        <Portal />
        <Configuration />
      </ConfigProvider>
    );
    const before = { ...counts };
    const callbacks = [value.setConfig, value.updateConfig, value.setOutputPathInfo];
    act(() =>
      value.setOutputPathInfo({ resolvedOutputPath: '/review.xml', outputPathWritable: false })
    );
    expect(counts).toEqual({ ...before, output: before.output + 1 });
    expect([value.setConfig, value.updateConfig, value.setOutputPathInfo]).toEqual(callbacks);
    act(() => value.updateConfig({ theme: 'dark' }));
    expect(counts).toEqual({
      ...before,
      output: before.output + 1,
      appearance: before.appearance + 1,
      configuration: before.configuration + 1,
    });
    expect(value.portalContainer?.classList.contains('dark')).toBe(true);
  });
});
