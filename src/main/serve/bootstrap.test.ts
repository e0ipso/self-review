import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { validateOutputPath } from './bootstrap';

describe('validateOutputPath', () => {
  let tmp: string;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-output-'));
  });

  afterEach(() => {
    fs.chmodSync(tmp, 0o700);
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('accepts a writable directory without creating the file', () => {
    const target = path.join(tmp, 'review.xml');
    const result = validateOutputPath(target);

    expect(result.ok).toBe(true);
    expect(fs.existsSync(target)).toBe(false);
  });

  it('accepts an existing writable file', () => {
    const target = path.join(tmp, 'review.xml');
    fs.writeFileSync(target, 'previous');
    expect(validateOutputPath(target).ok).toBe(true);
    expect(fs.readFileSync(target, 'utf-8')).toBe('previous');
  });

  it('rejects a missing parent directory, naming it', () => {
    const target = path.join(tmp, 'nope', 'review.xml');
    const result = validateOutputPath(target);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain(path.join(tmp, 'nope'));
  });

  it('rejects a path that is itself a directory', () => {
    const target = path.join(tmp, 'adir');
    fs.mkdirSync(target);
    const result = validateOutputPath(target);

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('directory');
  });

  it('rejects an unwritable parent directory', () => {
    if (typeof process.getuid === 'function' && process.getuid() === 0) {
      // root bypasses the permission bits this asserts on.
      return;
    }
    fs.chmodSync(tmp, 0o500);
    const result = validateOutputPath(path.join(tmp, 'review.xml'));

    expect(result.ok).toBe(false);
    expect(result.ok === false && result.message).toContain('not writable');
  });
});
