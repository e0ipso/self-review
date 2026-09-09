import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

import { installBrowserApiStubs } from '../../test-helpers';

installBrowserApiStubs();

import CategorySelector from './CategorySelector';
import { ConfigProvider } from '../../context/ConfigContext';
import type { CategoryDef } from '@self-review/types';

function renderWithCategories(categories: CategoryDef[], value = '') {
  const onChange = vi.fn();
  render(
    <ConfigProvider initialConfig={{ categories }}>
      <CategorySelector value={value} onChange={onChange} />
    </ConfigProvider>
  );
  return { onChange };
}

describe('CategorySelector', () => {
  // SR-0040: ConfigProvider now catches an unusable `categories` list before
  // CategorySelector ever sees it and falls back to the built-in defaults, so
  // these two configs no longer reach the component empty — they reach it
  // recovered. CategorySelector's own blank-name filtering (still exercised
  // below by the mixed-list case) stays as a second line of defense.
  it('falls back to the built-in categories when initialConfig has none', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithCategories([]);

    expect(screen.queryByTestId('category-selector')).not.toBeNull();
    expect(screen.getByTestId('category-option-bug')).toBeTruthy();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no usable categories'));

    errorSpy.mockRestore();
  });

  it('falls back to the built-in categories when every category has a blank name', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderWithCategories([
      { name: '', description: 'Nameless', color: '#ff0000' },
      { name: '   ', description: 'Whitespace name', color: '#00ff00' },
    ]);

    expect(screen.queryByTestId('category-selector')).not.toBeNull();
    expect(screen.getByTestId('category-option-bug')).toBeTruthy();
    expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('no usable categories'));

    errorSpy.mockRestore();
  });

  it('renders only the usable categories, dropping blank-name entries', () => {
    renderWithCategories([
      { name: '', description: 'Nameless', color: '#ff0000' },
      { name: 'keep-me', description: 'A real category', color: '#00ff00' },
    ]);

    expect(screen.queryByTestId('category-selector')).not.toBeNull();
    expect(screen.getByTestId('category-option-keep-me')).toBeTruthy();
  });

  it('calls onChange with the clicked category name', () => {
    const { onChange } = renderWithCategories([
      { name: 'bug', description: 'Defect', color: '#e53e3e' },
      { name: 'nit', description: 'Nitpick', color: '#718096' },
    ]);

    fireEvent.click(screen.getByTestId('category-option-nit'));

    expect(onChange).toHaveBeenCalledWith('nit');
  });
});
