// src/main/ignore-filter.test.ts
// Unit tests for ignore-filter module

import { describe, it, expect } from 'vitest';
import { createIgnoreFilter } from './ignore-filter';

describe('createIgnoreFilter', () => {
  it('returns a function that keeps all paths when patterns is empty', () => {
    const shouldKeep = createIgnoreFilter([]);
    expect(shouldKeep('anything.ts')).toBe(true);
    expect(shouldKeep('node_modules/foo/bar.js')).toBe(true);
  });

  it('filters out files matching simple directory patterns', () => {
    const shouldKeep = createIgnoreFilter(['node_modules', '.git']);
    expect(shouldKeep('node_modules/foo/bar.js')).toBe(false);
    expect(shouldKeep('.git/config')).toBe(false);
    expect(shouldKeep('src/main/index.ts')).toBe(true);
  });

  it('filters out files matching glob patterns', () => {
    const shouldKeep = createIgnoreFilter(['*.min.js', '*.min.css']);
    expect(shouldKeep('bundle.min.js')).toBe(false);
    expect(shouldKeep('styles.min.css')).toBe(false);
    expect(shouldKeep('src/app.js')).toBe(true);
  });

  it('filters out exact file names', () => {
    const shouldKeep = createIgnoreFilter(['package-lock.json', 'yarn.lock']);
    expect(shouldKeep('package-lock.json')).toBe(false);
    expect(shouldKeep('yarn.lock')).toBe(false);
    expect(shouldKeep('package.json')).toBe(true);
  });

  it('supports negation patterns to re-include files', () => {
    const shouldKeep = createIgnoreFilter(['*.min.js', '!important.min.js']);
    expect(shouldKeep('bundle.min.js')).toBe(false);
    expect(shouldKeep('important.min.js')).toBe(true);
  });

  it('supports double-star glob patterns', () => {
    const shouldKeep = createIgnoreFilter(['dist/**']);
    expect(shouldKeep('dist/bundle.js')).toBe(false);
    expect(shouldKeep('dist/sub/chunk.js')).toBe(false);
    expect(shouldKeep('src/index.ts')).toBe(true);
  });

  it('handles nested directory matching', () => {
    const shouldKeep = createIgnoreFilter(['vendor']);
    expect(shouldKeep('vendor/autoload.php')).toBe(false);
    expect(shouldKeep('vendor/composer/ClassLoader.php')).toBe(false);
    expect(shouldKeep('src/vendor-utils.ts')).toBe(true);
  });
});
