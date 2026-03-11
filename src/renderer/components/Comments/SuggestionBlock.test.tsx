import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import SuggestionBlock from './SuggestionBlock';
import type { Suggestion } from '../../../shared/types';

describe('SuggestionBlock', () => {
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
