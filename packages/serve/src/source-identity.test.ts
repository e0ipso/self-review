// Audit A6: a directory or file review launched from another directory. The
// routes used to contain paths under the launch directory while core opened
// them under the reviewed one; now both go through core's source identity.
// Everything below runs the real startup, the real server and real routes.

import { describe, it, expect, beforeAll, afterAll, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import type * as http from 'node:http';
import { parseServeArgs } from './args';
import { resolveSession } from './startup';
import { createReviewServer, listenLoopback } from './server';

const SENTINEL = 'PRIVATE SENTINEL\n';
const CAPABILITY = 'test-capability-0123456789abcdefghijklmnopqrstuvwxyz';
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x42]);

let tmp: string;
let reviewed: string;
let outside: string;
let launch: string;
let server: http.Server | null = null;
let base = '';
const originalCwd = process.cwd();

function api(route: string, init: RequestInit = {}): Promise<Response> {
  return fetch(base + route, {
    ...init,
    headers: {
      authorization: `Bearer ${CAPABILITY}`,
      'content-type': 'application/json',
      ...(init.headers as Record<string, string>),
    },
  });
}

async function serve(args: string[]): Promise<void> {
  process.chdir(launch);
  const startup = await resolveSession(parseServeArgs(args));
  process.chdir(originalCwd);
  server = createReviewServer({ ...startup, capability: CAPABILITY, clientDir: launch });
  base = (await listenLoopback(server)).url.replace(/\/$/, '');
}

beforeAll(() => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'serve-source-identity-')));
  reviewed = path.join(tmp, 'reviewed');
  outside = path.join(tmp, 'outside');
  launch = path.join(tmp, 'launch');
  for (const dir of [reviewed, outside, launch]) fs.mkdirSync(dir);
  fs.writeFileSync(path.join(reviewed, 'safe.txt'), 'known original\n');
  fs.writeFileSync(path.join(reviewed, 'pic.png'), PNG);
  fs.writeFileSync(path.join(outside, 'target.txt'), SENTINEL);
  fs.symlinkSync(path.join(outside, 'target.txt'), path.join(reviewed, 'link.txt'));
  // The launch directory holds a same-named file, so a read rooted there
  // would succeed with the wrong bytes rather than fail.
  fs.writeFileSync(path.join(launch, 'pic.png'), Buffer.from('launch-dir-bytes'));
});

afterEach(() => {
  process.chdir(originalCwd);
});

/** Stop the server a group started; each group serves one review. */
async function stopServing(): Promise<void> {
  if (server) {
    const closing = server;
    server = null;
    closing.closeAllConnections();
    await new Promise<void>(resolve => closing.close(() => resolve()));
  }
}

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('a directory review launched from elsewhere', () => {
  beforeAll(() => serve(['--output', path.join(launch, 'review.xml'), reviewed]));
  afterAll(stopServing);

  it('records the reviewed directory, not the launch directory, as the source root', async () => {
    const startup = await (async () => {
      process.chdir(launch);
      try {
        return await resolveSession(parseServeArgs([reviewed]));
      } finally {
        process.chdir(originalCwd);
      }
    })();
    expect(startup.session.sourceIdentity).toMatchObject({
      mode: 'directory',
      sourceRoot: reviewed,
      invocationCwd: launch,
      newSide: { kind: 'directory' },
    });
    expect(startup).not.toHaveProperty('repositoryRoot');
  });

  it('serves the reviewed image from the reviewed directory', async () => {
    const res = await api('/api/image?path=pic.png');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Buffer.from(body.dataUri.split(',')[1], 'base64')).toEqual(PNG);
  });

  it('refuses the symlink the audit read through, without touching its target', async () => {
    const res = await api('/api/image?path=link.txt');
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain('PRIVATE');
  });

  it('refuses an absolute path and a traversal, on every path-taking route', async () => {
    const absolute = path.join(outside, 'target.txt');
    for (const candidate of [absolute, '../outside/target.txt', '../launch/pic.png']) {
      const encoded = encodeURIComponent(candidate);
      expect((await api(`/api/image?path=${encoded}`)).status, candidate).toBe(400);
      expect((await api(`/api/file?path=${encoded}`)).status, candidate).toBe(400);
      const expand = await api('/api/expand-context', {
        method: 'POST',
        body: JSON.stringify({ filePath: candidate, contextLines: 3 }),
      });
      expect(expand.status, candidate).toBe(400);
    }
  });

  it('refuses to apply through the symlink and leaves the outside file alone', async () => {
    const res = await api('/api/apply-suggestion', {
      method: 'POST',
      body: JSON.stringify({
        filePath: 'link.txt',
        lineRange: { side: 'new', start: 1, end: 1 },
        suggestion: { originalCode: 'PRIVATE SENTINEL', proposedCode: 'HTTP OUTSIDE WRITE' },
      }),
    });
    expect(res.status).toBe(400);
    expect(fs.readFileSync(path.join(outside, 'target.txt'), 'utf-8')).toBe(SENTINEL);
  });
});

describe('a file review launched from elsewhere', () => {
  beforeAll(() =>
    serve(['--output', path.join(launch, 'review.xml'), path.join(reviewed, 'pic.png')])
  );
  afterAll(stopServing);

  it('roots the review at the file’s own directory and serves that file', async () => {
    const res = await api('/api/image?path=pic.png');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Buffer.from(body.dataUri.split(',')[1], 'base64')).toEqual(PNG);
  });

  it('refuses its neighbours: only the named file was reviewed', async () => {
    expect((await api('/api/image?path=link.txt')).status).toBe(400);
    expect((await api('/api/file?path=safe.txt')).status).toBe(400);
  });
});
