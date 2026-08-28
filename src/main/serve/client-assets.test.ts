import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { CLIENT_DIR_ENV, resolveClientAssetsDir } from './client-assets';

describe('resolveClientAssetsDir', () => {
  const original = process.env[CLIENT_DIR_ENV];
  let tmp: string;

  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-client-'));
  });

  afterEach(() => {
    if (original === undefined) delete process.env[CLIENT_DIR_ENV];
    else process.env[CLIENT_DIR_ENV] = original;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('prefers an explicit override when it exists', () => {
    process.env[CLIENT_DIR_ENV] = tmp;
    const result = resolveClientAssetsDir();

    expect(result.dir).toBe(path.resolve(tmp));
    expect(result.exists).toBe(true);
  });

  it('reports a missing bundle instead of throwing, and lists where it looked', () => {
    process.env[CLIENT_DIR_ENV] = path.join(tmp, 'absent');
    const result = resolveClientAssetsDir();

    expect(result.exists).toBe(false);
    expect(result.candidates.length).toBeGreaterThan(0);
    expect(result.dir).toBe(path.join(tmp, 'absent'));
  });
});
