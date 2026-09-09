import React from 'react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { CategoryDef } from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();

import { ConfigProvider, useConfig, defaultConfig } from './ConfigContext';

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
  return Array.from(
    screen.getByTestId('categories-probe').querySelectorAll('li')
  ).map(li => li.textContent);
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
