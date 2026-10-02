import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CategoryDef } from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();

import { ConfigProvider, useConfig, defaultConfig } from './ConfigContext';
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
