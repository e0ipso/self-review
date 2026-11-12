import React from 'react';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import FrontMatterTable from './FrontMatterTable';
import SuggestionApplyControl from '../Comments/SuggestionApplyControl';
import { LocalizationProvider } from '../../localization/LocalizationContext';
import { ReviewAdapterProvider } from '../../context/ReviewAdapterContext';
import { SPANISH_REVIEW } from '../../../../../src/shared/spanish-review';
import { FRONT_MATTER_MAX_NODES } from '../../utils/front-matter';
afterEach(cleanup);
it.each(['cycle', 'depth', 'nodes'] as const)(
  'localizes the actual %s front-matter fallback',
  reason => {
    let value: unknown;
    if (reason === 'cycle') {
      const loop: unknown[] = [];
      loop.push(loop);
      value = loop;
    } else if (reason === 'depth') {
      value = 'leaf';
      for (let i = 0; i < 100; i++) value = { nested: value };
    } else value = Array.from({ length: FRONT_MATTER_MAX_NODES + 1 }, () => 1);
    render(
      <LocalizationProvider locale='es' messages={SPANISH_REVIEW}>
        <FrontMatterTable metadata={{ value }} />
      </LocalizationProvider>
    );
    expect(screen.getByTestId('front-matter-fallback').textContent).toContain(
      'El cuerpo del documento se muestra debajo.'
    );
    expect(screen.getByTestId('front-matter-fallback').textContent).not.toContain('Front matter');
  }
);
it('uses catalog overrides for null values and keeps source metadata intact', () => {
  render(
    <LocalizationProvider messages={{ null: 'empty value' }}>
      <FrontMatterTable metadata={{ nothing: null, literal: 'null' }} />
    </LocalizationProvider>
  );
  expect(screen.getByText('empty value')).toBeTruthy();
  expect(screen.getByText('null')).toBeTruthy();
});
it.each(['context-mismatch', 'file-missing', 'future-refusal'])(
  'localizes known %s summaries and preserves host detail',
  async reason => {
    const detail = 'Original diagnostic for src/important.ts: version 9';
    render(
      <LocalizationProvider locale='es' messages={SPANISH_REVIEW}>
        <ReviewAdapterProvider
          adapter={{
            loadDiff: vi.fn(),
            applySuggestion: async () => ({
              status: 'refused',
              filePath: 'src/important.ts',
              reason,
              detail,
            }),
          }}
        >
          <SuggestionApplyControl
            filePath='src/important.ts'
            lineRange={{ side: 'new', start: 1, end: 1 }}
            suggestion={{ originalCode: 'a', proposedCode: 'b' }}
          />
        </ReviewAdapterProvider>
      </LocalizationProvider>
    );
    fireEvent.click(screen.getByTestId('suggestion-apply-button'));
    const outcome = await screen.findByTestId('suggestion-apply-outcome');
    expect(outcome.textContent).toContain(detail);
    if (reason === 'context-mismatch')
      expect(outcome.textContent).toContain('El código original ya no coincide con el destino.');
    else if (reason === 'file-missing')
      expect(outcome.textContent).toContain('El archivo no está en el destino.');
    else expect(outcome.textContent).toBe(`No aplicado. ${detail}`);
  }
);
