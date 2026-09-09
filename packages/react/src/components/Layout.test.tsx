import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { DiffFile } from '@self-review/types';

import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();

// react-resizable-panels measures its panels through a ResizeObserver, which
// jsdom does not implement. The stub never fires: the tests below drive the
// panel through its imperative handle, not through layout changes.
class NoopResizeObserver {
  observe(): void {}
  unobserve(): void {}
  disconnect(): void {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
  NoopResizeObserver;

import Layout from './Layout';
import { ConfigProvider } from '../context/ConfigContext';
import { ReviewProvider } from '../context/ReviewContext';
import { DiffNavigationProvider } from '../context/DiffNavigationContext';

const file: DiffFile = {
  oldPath: 'src/foo.ts',
  newPath: 'src/foo.ts',
  changeType: 'modified',
  isBinary: false,
  hunks: [],
};

function renderLayout() {
  return render(
    <ConfigProvider>
      <ReviewProvider initialFiles={[file]}>
        <DiffNavigationProvider>
          <Layout />
        </DiffNavigationProvider>
      </ReviewProvider>
    </ConfigProvider>
  );
}

function fileTreePanel(): HTMLElement {
  const panel = document.getElementById('fileTree');
  if (!panel) throw new Error('file tree panel not rendered');
  return panel;
}

function sidebar(): HTMLElement {
  const el = fileTreePanel().querySelector<HTMLElement>('.bg-sidebar');
  if (!el) throw new Error('sidebar wrapper not rendered');
  return el;
}

describe('Layout file tree collapse', () => {
  it('starts expanded and offers a collapse control', () => {
    renderLayout();
    const toggle = screen.getByTestId('file-tree-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(toggle.getAttribute('aria-label')).toBe('Hide file tree');
    expect(toggle.getAttribute('aria-controls')).toBe('fileTree');
    expect(fileTreePanel().style.flexGrow).not.toBe('0');
  });

  it('collapses the file tree panel when the control is activated', () => {
    renderLayout();
    fireEvent.click(screen.getByTestId('file-tree-toggle'));

    expect(fileTreePanel().style.flexGrow).toBe('0');
    const toggle = screen.getByTestId('file-tree-toggle');
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    expect(toggle.getAttribute('aria-label')).toBe('Show file tree');
  });

  it('restores the panel to its previous size on a second activation', () => {
    renderLayout();
    const before = fileTreePanel().style.flexGrow;

    fireEvent.click(screen.getByTestId('file-tree-toggle'));
    fireEvent.click(screen.getByTestId('file-tree-toggle'));

    expect(fileTreePanel().style.flexGrow).toBe(before);
    expect(
      screen.getByTestId('file-tree-toggle').getAttribute('aria-expanded')
    ).toBe('true');
  });

  it('keeps the tree mounted but inert while collapsed', () => {
    renderLayout();
    expect(screen.getByTestId('file-tree')).toBeTruthy();
    expect(sidebar().hasAttribute('inert')).toBe(false);

    fireEvent.click(screen.getByTestId('file-tree-toggle'));

    // Still mounted, so the review state it holds survives the collapse.
    expect(screen.getByTestId('file-tree')).toBeTruthy();
    expect(sidebar().hasAttribute('inert')).toBe(true);

    fireEvent.click(screen.getByTestId('file-tree-toggle'));
    expect(sidebar().hasAttribute('inert')).toBe(false);
  });

  it('preserves the file filter typed before collapsing', () => {
    renderLayout();
    const filter = screen.getByPlaceholderText('Filter files...');
    fireEvent.change(filter, { target: { value: 'foo' } });

    fireEvent.click(screen.getByTestId('file-tree-toggle'));
    fireEvent.click(screen.getByTestId('file-tree-toggle'));

    expect(
      screen.getByPlaceholderText<HTMLInputElement>('Filter files...').value
    ).toBe('foo');
  });

  it('exposes the control as a keyboard-operable button', () => {
    renderLayout();
    const toggle = screen.getByTestId('file-tree-toggle');
    expect(toggle.tagName).toBe('BUTTON');
    expect(toggle.hasAttribute('disabled')).toBe(false);

    toggle.focus();
    expect(document.activeElement).toBe(toggle);

    // Native buttons translate Enter and Space into a click; assert the
    // handler is wired to click rather than to a pointer-only path.
    fireEvent.click(toggle);
    expect(fileTreePanel().style.flexGrow).toBe('0');
  });
});
