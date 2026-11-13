import Prism from 'prismjs';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import SuggestionBlock from './SuggestionBlock';
import type { Suggestion } from '@self-review/types';

describe('SuggestionBlock', () => {
  it('keeps source literal when the highlighter fails', () => {
    const highlight = vi.spyOn(Prism, 'highlight').mockImplementation(() => {
      throw new Error('highlight failed');
    });
    try {
      const source = '<img src=x onerror=alert(1)> & <script>alert(1)</script>';
      const { container } = render(
        <SuggestionBlock suggestion={{ originalCode: source, proposedCode: source }} />
      );
      expect(container.querySelector('img, script')).toBeNull();
      expect(container.querySelector('.suggestion-deletion')?.textContent).toBe('-' + source);
      expect(container.querySelector('.suggestion-addition')?.textContent).toBe('+' + source);
    } finally {
      highlight.mockRestore();
    }
  });

  it('preserves leading whitespace in original and proposed code', () => {
    const suggestion: Suggestion = {
      originalCode: '    const x = 1;',
      proposedCode: '    const x = 2;',
    };

    render(<SuggestionBlock suggestion={suggestion} language='typescript' />);

    const block = screen.getByTestId('suggestion-block');
    const deletionLine = block.querySelector('.suggestion-deletion span:last-child');
    const additionLine = block.querySelector('.suggestion-addition span:last-child');

    expect(deletionLine?.className).toContain('whitespace-pre');
    expect(additionLine?.className).toContain('whitespace-pre');
  });

  it('renders multi-line suggestions with indentation', () => {
    const suggestion: Suggestion = {
      originalCode: 'if (true) {\n  doSomething();\n}',
      proposedCode: 'if (true) {\n  doSomethingElse();\n  doMore();\n}',
    };

    render(<SuggestionBlock suggestion={suggestion} language='typescript' />);

    const block = screen.getByTestId('suggestion-block');
    const deletions = block.querySelectorAll('.suggestion-deletion');
    const additions = block.querySelectorAll('.suggestion-addition');

    expect(deletions).toHaveLength(3);
    expect(additions).toHaveLength(4);
  });
});

it('bounds suggestion highlighting across both sides while retaining all literal code', () => {
  const highlight = vi.spyOn(Prism, 'highlight');
  const last = '<img src=x onerror=alert(1)>literal last line';
  const original = Array.from({ length: 1005 }, (_, i) =>
    i === 1004 ? last : `const a${i} = 1;`
  ).join('\n');
  const { container } = render(
    <SuggestionBlock
      suggestion={{ originalCode: original, proposedCode: 'proposed after budget' }}
    />
  );
  expect(highlight.mock.calls.length).toBeLessThanOrEqual(1000);
  expect(container.querySelectorAll('.suggestion-deletion')).toHaveLength(1005);
  expect(container.querySelectorAll('.suggestion-deletion')[1004]?.textContent).toContain(last);
  expect(container.querySelector('.suggestion-addition')?.textContent).toContain(
    'proposed after budget'
  );
  expect(container.querySelector('img')).toBeNull();
  expect(screen.getByRole('status').textContent).toContain('All code remains available');
});

it('never highlights an oversized suggestion line', () => {
  const highlight = vi.spyOn(Prism, 'highlight');
  const source = '<script>literal</script>' + 'x'.repeat(2000);
  const { container } = render(
    <SuggestionBlock suggestion={{ originalCode: source, proposedCode: source }} />
  );
  expect(highlight).not.toHaveBeenCalled();
  expect(container.querySelector('script')).toBeNull();
  expect(container.querySelector('.suggestion-addition')?.textContent).toBe('+' + source);
});
