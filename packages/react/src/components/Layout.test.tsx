import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, act } from '@testing-library/react';
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
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = NoopResizeObserver;

import Layout from './Layout';
import { KeyboardNavigationManager } from './KeyboardNavigationManager';
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

function renderLayout(children: React.ReactNode = null) {
  return render(
    <ConfigProvider>
      <ReviewProvider initialFiles={[file]}>
        <DiffNavigationProvider>
          <Layout />
          {children}
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
    expect(screen.getByTestId('file-tree-toggle').getAttribute('aria-expanded')).toBe('true');
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

    expect(screen.getByPlaceholderText<HTMLInputElement>('Filter files...').value).toBe('foo');
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

// SR-0043: the `g` hint key collects file-tree targets by their rects, and a
// collapsed panel renders every entry at zero width, so hint-file mode found
// nothing. enterHintMode asks Layout to restore the panel first through this
// event.
//
// These tests cover the request and the restore. They do not cover what the
// hint collector then measures: jsdom performs no layout, so every rect is
// zero here and only a browser can show whether the collector sees the
// restored panel.
describe('expand-file-tree request', () => {
  function requestExpand(): void {
    document.dispatchEvent(new CustomEvent('expand-file-tree'));
  }

  // Runs fn with React's act environment off, so a render React schedules
  // during fn is flushed by React's own scheduling rather than by act().
  function withoutActEnvironment(fn: () => void): void {
    const global = globalThis as unknown as { IS_REACT_ACT_ENVIRONMENT: boolean };
    const previous = global.IS_REACT_ACT_ENVIRONMENT;
    global.IS_REACT_ACT_ENVIRONMENT = false;
    try {
      fn();
    } finally {
      global.IS_REACT_ACT_ENVIRONMENT = previous;
    }
  }

  it('restores a collapsed panel', () => {
    renderLayout();
    fireEvent.click(screen.getByTestId('file-tree-toggle'));
    expect(fileTreePanel().style.flexGrow).toBe('0');

    act(requestExpand);

    expect(fileTreePanel().style.flexGrow).not.toBe('0');
    expect(screen.getByTestId('file-tree-toggle').getAttribute('aria-expanded')).toBe('true');
    expect(sidebar().hasAttribute('inert')).toBe(false);
  });

  it('commits the restored width before the dispatch returns', () => {
    // The requester reads rects on the statement after dispatchEvent returns,
    // so the restore has to reach the DOM inside the dispatch. jsdom performs
    // no layout, so this pins the commit ordering — the inline width is
    // written before the dispatch returns — not the rects a browser would
    // then report. Dispatched outside act() on purpose: act() flushes the
    // pending render for us and would hide the very gap under test.
    renderLayout();
    fireEvent.click(screen.getByTestId('file-tree-toggle'));
    expect(fileTreePanel().style.flexGrow).toBe('0');

    withoutActEnvironment(requestExpand);

    expect(fileTreePanel().style.flexGrow).not.toBe('0');
  });

  it('leaves an already expanded panel at its current size', () => {
    renderLayout();
    const before = fileTreePanel().style.flexGrow;

    act(requestExpand);

    expect(fileTreePanel().style.flexGrow).toBe(before);
    expect(screen.getByTestId('file-tree-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('stops listening once Layout unmounts', () => {
    const { unmount } = renderLayout();
    fireEvent.click(screen.getByTestId('file-tree-toggle'));
    unmount();

    // A listener surviving unmount would reach into a detached panel handle.
    expect(() => act(requestExpand)).not.toThrow();
  });

  it('restores the panel when the g shortcut runs for real', () => {
    renderLayout(<KeyboardNavigationManager />);
    fireEvent.click(screen.getByTestId('file-tree-toggle'));
    expect(fileTreePanel().style.flexGrow).toBe('0');

    fireEvent.keyDown(document, { key: 'g' });

    expect(fileTreePanel().style.flexGrow).not.toBe('0');
    expect(screen.getByTestId('file-tree-toggle').getAttribute('aria-expanded')).toBe('true');
  });

  it('leaves the panel alone for the other shortcuts', () => {
    renderLayout(<KeyboardNavigationManager />);
    fireEvent.click(screen.getByTestId('file-tree-toggle'));

    // j/k are left out on purpose: they call Element.scrollBy, which jsdom
    // does not implement, and the panel is not their concern.
    for (const key of ['f', 'Escape', 'x']) {
      fireEvent.keyDown(document, { key });
      expect(fileTreePanel().style.flexGrow).toBe('0');
    }
  });

  it('does not fire g while a text input has focus', () => {
    renderLayout(<KeyboardNavigationManager />);
    fireEvent.click(screen.getByTestId('file-tree-toggle'));

    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    fireEvent.keyDown(document, { key: 'g' });
    document.body.removeChild(input);

    expect(fileTreePanel().style.flexGrow).toBe('0');
  });
});
