import { describe, it, expect } from 'vitest';
import { getLanguageFromPath } from './file-type-utils';

describe('getLanguageFromPath', () => {
  it('maps file extensions to Prism language ids', () => {
    expect(getLanguageFromPath('src/App.svelte')).toBe('svelte');
    expect(getLanguageFromPath('src/a.ts')).toBe('typescript');
    expect(getLanguageFromPath('docs/page.html')).toBe('markup');
    expect(getLanguageFromPath('notes.unknownext')).toBe('plaintext');
  });
});
