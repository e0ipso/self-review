// src/main/fs-utils.test.ts
// Unit tests for filesystem utility functions.

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { checkWritability } from './fs-utils';
import * as fs from 'fs';

vi.mock('fs');

describe('checkWritability', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns true when parent directory is writable', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => undefined);

    expect(checkWritability('/tmp/review.xml')).toBe(true);
    expect(fs.accessSync).toHaveBeenCalledWith('/tmp', fs.constants.W_OK);
  });

  it('returns false when parent directory is not writable', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => {
      const err = new Error('EACCES: permission denied');
      (err as NodeJS.ErrnoException).code = 'EACCES';
      throw err;
    });

    expect(checkWritability('/root/review.xml')).toBe(false);
  });

  it('returns false when parent directory does not exist', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => {
      const err = new Error('ENOENT: no such file or directory');
      (err as NodeJS.ErrnoException).code = 'ENOENT';
      throw err;
    });

    expect(checkWritability('/nonexistent/dir/review.xml')).toBe(false);
  });

  it('checks the parent directory, not the file path itself', () => {
    vi.mocked(fs.accessSync).mockImplementation(() => undefined);

    checkWritability('/home/user/projects/output.xml');

    expect(fs.accessSync).toHaveBeenCalledWith(
      '/home/user/projects',
      fs.constants.W_OK
    );
  });
});
