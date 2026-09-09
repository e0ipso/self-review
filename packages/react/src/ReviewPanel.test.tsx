import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ReviewAdapter } from './adapter';

import { installBrowserApiStubs } from './test-helpers';

installBrowserApiStubs();

// Layout pulls in the full file tree + diff viewer stack, which is out of
// scope here. Rendering the live categories from context instead of the
// real Layout lets the SR-0040 fallback test below observe what
// ConfigProvider produced from the `config` prop ReviewPanel forwards to it.
vi.mock('./components/Layout', async () => {
  const { useConfig } = await import('./context/ConfigContext');
  return {
    default: () => {
      const { config } = useConfig();
      return <div data-testid='category-names'>{config.categories.map(c => c.name).join(',')}</div>;
    },
  };
});

import { ReviewPanel } from './ReviewPanel';

const adapter: ReviewAdapter = {
  loadDiff: async () => ({
    files: [],
    source: { type: 'directory', sourcePath: '' },
  }),
};

describe('ReviewPanel config forwarding', () => {
  // SR-0040: ReviewPanel forwards its `config` prop straight into
  // ConfigProvider (see ReviewPanel.tsx `initialConfig={config}`). An
  // unusable categories list must recover through that same provider
  // rather than reach the rendered tree empty.
  it('recovers with default categories when given an unusable config.categories prop', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(<ReviewPanel adapter={adapter} config={{ categories: [] }} />);

    // Waits out ReviewProvider's adapter.loadDiff() microtask via RTL's
    // act-wrapped polling, so the resulting state update isn't flagged as
    // an unwrapped act() update once the test body returns.
    const names = (await screen.findByTestId('category-names')).textContent;
    expect(names).not.toBe('');
    expect(names?.split(',')).toContain('bug');
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no usable categories'));

    errorSpy.mockRestore();
  });

  it('leaves a valid config.categories prop unaffected', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <ReviewPanel
        adapter={adapter}
        config={{ categories: [{ name: 'custom', description: 'd', color: '#fff' }] }}
      />
    );

    expect((await screen.findByTestId('category-names')).textContent).toBe('custom');
    expect(errorSpy).not.toHaveBeenCalled();

    errorSpy.mockRestore();
  });
});
