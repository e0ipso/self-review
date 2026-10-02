import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { act, fireEvent, renderHook } from '@testing-library/react';
import { generateLabels, isTextInputFocused, useKeyboardNavigation } from './useKeyboardNavigation';
import { DiffNavigationProvider } from '../context/DiffNavigationContext';
import { installBrowserApiStubs } from '../test-helpers';

installBrowserApiStubs();

describe('generateLabels', () => {
  it('returns empty array for zero count', () => {
    expect(generateLabels(0)).toEqual([]);
  });

  it('returns single characters for small counts', () => {
    const labels = generateLabels(3);
    expect(labels).toEqual(['a', 's', 'd']);
  });

  it('returns all single chars for count equal to charset length', () => {
    const labels = generateLabels(18);
    expect(labels).toHaveLength(18);
    expect(new Set(labels).size).toBe(18);
  });

  it('returns two-char combos when count exceeds charset', () => {
    const labels = generateLabels(20);
    expect(labels).toHaveLength(20);
    // Outer loop iterates first char, inner loop second
    expect(labels[0]).toBe('aa');
    expect(labels[1]).toBe('as');
    expect(labels[18]).toBe('sa');
    expect(labels[19]).toBe('ss');
    // Every label should be exactly 2 characters
    labels.forEach(label => expect(label).toHaveLength(2));
  });

  it('generates unique labels', () => {
    const labels = generateLabels(50);
    expect(new Set(labels).size).toBe(50);
  });
});

describe('isTextInputFocused', () => {
  it('returns false when no element is focused', () => {
    expect(isTextInputFocused()).toBe(false);
  });

  it('returns true when input is focused', () => {
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    expect(isTextInputFocused()).toBe(true);
    document.body.removeChild(input);
  });

  it('returns true when textarea is focused', () => {
    const textarea = document.createElement('textarea');
    document.body.appendChild(textarea);
    textarea.focus();
    expect(isTextInputFocused()).toBe(true);
    document.body.removeChild(textarea);
  });

  it('returns true when contenteditable is focused', () => {
    const div = document.createElement('div');
    div.setAttribute('contenteditable', 'true');
    document.body.appendChild(div);
    div.focus();
    expect(isTextInputFocused()).toBe(true);
    document.body.removeChild(div);
  });

  it('returns true when element inside md-editor is focused', () => {
    const editor = document.createElement('div');
    editor.className = 'w-md-editor';
    const textarea = document.createElement('textarea');
    editor.appendChild(textarea);
    document.body.appendChild(editor);
    textarea.focus();
    expect(isTextInputFocused()).toBe(true);
    document.body.removeChild(editor);
  });

  it('returns false for regular buttons', () => {
    const button = document.createElement('button');
    document.body.appendChild(button);
    button.focus();
    expect(isTextInputFocused()).toBe(false);
    document.body.removeChild(button);
  });
});

describe('useKeyboardNavigation f hint', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  function composer(): HTMLTextAreaElement {
    const wrapper = document.createElement('div');
    wrapper.setAttribute('data-testid', 'comment-input');
    const textarea = document.createElement('textarea');
    wrapper.appendChild(textarea);
    document.body.appendChild(wrapper);
    return textarea;
  }

  it('leaves focus on the composer the hint opened, not the first one in the document', async () => {
    // A composer already open higher up the page.
    composer();

    const section = document.createElement('div');
    section.setAttribute('data-file-path', 'src/b.ts');
    const line = document.createElement('div');
    line.setAttribute('data-line-type', 'addition');
    line.setAttribute('data-line-number', '7');
    line.setAttribute('data-line-side', 'new');
    line.getBoundingClientRect = () => new DOMRect(10, 10, 100, 20);
    section.appendChild(line);
    document.body.appendChild(section);

    // Stands in for the composer focusing itself on mount, as ComposerCore does.
    let opened: HTMLTextAreaElement | null = null;
    const onTrigger = () => {
      opened = composer();
      opened.focus();
    };
    document.addEventListener('trigger-line-comment', onTrigger);

    renderHook(() => useKeyboardNavigation(), {
      wrapper: ({ children }) => React.createElement(DiffNavigationProvider, null, children),
    });

    act(() => {
      fireEvent.keyDown(document, { key: 'f' });
    });
    act(() => {
      fireEvent.keyDown(document, { key: 'a' });
    });
    await act(() => new Promise(resolve => setTimeout(resolve, 50)));

    document.removeEventListener('trigger-line-comment', onTrigger);
    expect(opened).not.toBeNull();
    expect(document.activeElement).toBe(opened);
  });
});
