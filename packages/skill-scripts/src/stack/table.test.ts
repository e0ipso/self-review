import { mkdtempSync, rmSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { serveStatus } from './table';

describe('serveStatus', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'stack-table-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads a review file with no server log as completed (desktop mode)', () => {
    writeFileSync(path.join(dir, '01-a.review.xml'), '<review/>\n');
    expect(serveStatus(dir, '01-a')).toBe('completed (`01-a.review.xml`)');
  });

  it('gives the URL again when a server restarted after completing', () => {
    writeFileSync(
      path.join(dir, '01-a.serve.log'),
      [
        '[serve] Review ready at http://127.0.0.1:1/',
        '[serve] Review complete; stopping.',
        '[serve] Review ready at http://127.0.0.1:2/',
        '',
      ].join('\n')
    );
    expect(serveStatus(dir, '01-a')).toBe('http://127.0.0.1:2/');
  });
});
