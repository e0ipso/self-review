import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import * as net from 'net';
import type { AddressInfo } from 'net';
import * as core from '@self-review/core';
import type { DiffFile, ReviewSession, ReviewState, AppConfig } from '@self-review/core';
import { createReviewServer, listenLoopback } from './server';

// Wrap every core function the routes call in a spy that passes through to
// the real implementation. Success tests then exercise the real code; the
// rejection tests assert the spy was never reached. `readAttachment` takes
// no session, so a spy at the module boundary is the only seam that covers
// all eight uniformly.
vi.mock('@self-review/core', async importOriginal => {
  const actual = await importOriginal<typeof import('@self-review/core')>();
  return {
    ...actual,
    getDiffLoad: vi.fn(actual.getDiffLoad),
    getConfigLoad: vi.fn(actual.getConfigLoad),
    getResumeLoad: vi.fn(actual.getResumeLoad),
    getFileHunks: vi.fn(actual.getFileHunks),
    loadImage: vi.fn(actual.loadImage),
    readAttachment: vi.fn(actual.readAttachment),
    expandContext: vi.fn(actual.expandContext),
    submitReviewState: vi.fn(actual.submitReviewState),
  };
});

// Fixture layout — real paths, so containment is checked against a real tree:
//
//   <tmp>/
//     outside/secret.txt
//     repo/
//       src/index.ts
//       img.png
//       attach.bin
//     client/
//       index.html
//       assets/app.js
let tmp: string;
let root: string;
let clientDir: string;
let session: ReviewSession;
let server: ReturnType<typeof createReviewServer>;
let base: string;

const CORE_SPIES = [
  'getDiffLoad',
  'getConfigLoad',
  'getResumeLoad',
  'getFileHunks',
  'loadImage',
  'readAttachment',
  'expandContext',
  'submitReviewState',
] as const;

function diffFile(p: string, hunks: DiffFile['hunks'] = []): DiffFile {
  return { oldPath: p, newPath: p, changeType: 'added', isBinary: false, hunks };
}

const INDEX_HUNK: DiffFile['hunks'][number] = {
  header: '@@ -0,0 +1 @@',
  oldStart: 0,
  oldLines: 0,
  newStart: 1,
  newLines: 1,
  lines: [{ type: 'add', content: 'export {};', oldLineNumber: null, newLineNumber: 1 }],
};

const CONFIG: AppConfig = {
  theme: 'dark',
  diffView: 'split',
  fontSize: 14,
  outputFormat: 'xml',
  outputFile: 'review.xml',
  ignore: [],
  categories: [],
  defaultDiffArgs: '',
  showUntracked: true,
  showUntrackedExplicit: false,
  wordWrap: true,
  maxFiles: 500,
  maxTotalLines: 50_000,
};

function freshSession(): ReviewSession {
  const s = core.createReviewSession();
  s.diffData = {
    source: { type: 'git', gitDiffArgs: '--staged', repository: root },
    files: [diffFile('src/index.ts', [INDEX_HUNK]), diffFile('img.png')],
  };
  s.guideData = { overview: 'Start with the entry point.', groups: [] };
  s.config = CONFIG;
  s.outputPathInfo = { resolvedOutputPath: path.join(root, 'review.xml'), outputPathWritable: true };
  return s;
}

function expectNoCoreCall() {
  for (const name of CORE_SPIES) {
    expect(vi.mocked(core[name]), name).not.toHaveBeenCalled();
  }
}

async function postJson(route: string, body: unknown, init: RequestInit = {}) {
  return fetch(base + route, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });
}

/**
 * Issue a request with headers `fetch` refuses to send.
 *
 * `Host` is a forbidden header name: undici drops it silently and sends the
 * real one, so a test written with `fetch` would assert against a request the
 * server never saw and pass for the wrong reason. Going through `node:http`
 * is the only way to put an attacker's `Host` on the wire.
 */
function rawGet(
  routePath: string,
  headers: Record<string, string>
): Promise<{ status: number; body: string }> {
  const { port } = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: routePath, method: 'GET', headers },
      res => {
        let body = '';
        res.setEncoding('utf-8');
        res.on('data', chunk => (body += chunk));
        res.on('end', () => resolve({ status: res.statusCode ?? 0, body }));
      }
    );
    req.on('error', reject);
    req.end();
  });
}

/**
 * Send a handcrafted request over a bare socket.
 *
 * A duplicate `Host` cannot be produced by any HTTP client — `node:http`
 * collapses it and `fetch` refuses the header outright — so the only way to
 * put two on the wire is to write the request ourselves.
 */
function rawGetRaw(request: string): Promise<string> {
  const { port } = server.address() as AddressInfo;
  return new Promise((resolve, reject) => {
    const socket = net.connect(port, '127.0.0.1', () => socket.write(request));
    let data = '';
    socket.setEncoding('utf-8');
    socket.on('data', chunk => (data += chunk));
    socket.on('end', () => resolve(data));
    socket.on('error', reject);
  });
}

beforeAll(async () => {
  tmp = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'serve-server-')));
  root = path.join(tmp, 'repo');
  clientDir = path.join(tmp, 'client');
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.writeFileSync(path.join(root, 'src', 'index.ts'), 'export {};\n');
  fs.writeFileSync(path.join(root, 'img.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  fs.writeFileSync(path.join(root, 'attach.bin'), Buffer.from('attachment-bytes'));
  fs.mkdirSync(path.join(tmp, 'outside'));
  fs.writeFileSync(path.join(tmp, 'outside', 'secret.txt'), 'secret\n');
  fs.mkdirSync(path.join(clientDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html><title>self-review</title>');
  fs.writeFileSync(path.join(clientDir, 'assets', 'app.js'), 'console.log("app");\n');

  session = freshSession();
  server = createReviewServer({ session, repositoryRoot: root, clientDir });
  const { port } = await listenLoopback(server, 0);
  base = `http://127.0.0.1:${port}`;
});

afterAll(async () => {
  await new Promise<void>(resolve => server.close(() => resolve()));
  fs.rmSync(tmp, { recursive: true, force: true });
});

beforeEach(() => {
  vi.clearAllMocks();
  // Reset the mutable parts a previous test may have touched.
  session.reviewState = null;
  session.resumeComments = [];
  session.resumeViewedFiles = [];
  session.resumeRemoteDrift = null;
});

describe('listener', () => {
  it('binds to 127.0.0.1 only', () => {
    const address = server.address() as AddressInfo;
    expect(address.address).toBe('127.0.0.1');
  });
});

describe('GET /api/diff', () => {
  it('returns the diff and the guide in one response', async () => {
    const res = await fetch(`${base}/api/diff`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.diff.files.map((f: DiffFile) => f.newPath)).toEqual(['src/index.ts', 'img.png']);
    expect(body.diff.source).toEqual(session.diffData!.source);
    expect(body.guide).toEqual({ overview: 'Start with the entry point.', groups: [] });
    expect(vi.mocked(core.getDiffLoad)).toHaveBeenCalledWith(session);
  });
});

describe('GET /api/config', () => {
  it('returns the config and the output path info', async () => {
    const res = await fetch(`${base}/api/config`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config.theme).toBe('dark');
    expect(body.outputPathInfo).toEqual(session.outputPathInfo);
    expect(vi.mocked(core.getConfigLoad)).toHaveBeenCalledWith(session);
  });
});

describe('GET /api/resume', () => {
  it('returns null when there is nothing to resume', async () => {
    const res = await fetch(`${base}/api/resume`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('returns the resumed comments and viewed files', async () => {
    session.resumeViewedFiles = ['src/index.ts'];
    const res = await fetch(`${base}/api/resume`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ comments: [], viewedFiles: ['src/index.ts'] });
    expect(vi.mocked(core.getResumeLoad)).toHaveBeenCalledWith(session);
  });
});

describe('GET /api/file', () => {
  it('returns the hunks of a file in the diff', async () => {
    const res = await fetch(`${base}/api/file?path=${encodeURIComponent('src/index.ts')}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([INDEX_HUNK]);
    expect(vi.mocked(core.getFileHunks)).toHaveBeenCalledWith(session, 'src/index.ts');
  });

  it('returns null for a contained path the diff does not know', async () => {
    const res = await fetch(`${base}/api/file?path=src/other.ts`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('rejects a traversal path with 400 before reaching core', async () => {
    const res = await fetch(`${base}/api/file?path=${encodeURIComponent('../outside/secret.txt')}`);
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects a missing path parameter with 400 before reaching core', async () => {
    const res = await fetch(`${base}/api/file`);
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });
});

describe('GET /api/image', () => {
  it('returns the image as a data URI', async () => {
    const res = await fetch(`${base}/api/image?path=img.png`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dataUri).toBe(`data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')}`);
    expect(vi.mocked(core.loadImage)).toHaveBeenCalledWith(session, 'img.png');
  });

  it('rejects a traversal path with 400 before reaching core', async () => {
    const res = await fetch(`${base}/api/image?path=${encodeURIComponent('../outside/secret.txt')}`);
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('treats a whole-path-encoded traversal as a literal filename inside the root', async () => {
    // The query is decoded exactly once, so `%252E%252E%252F...` arrives as
    // the filename `%2E%2E%2Foutside%2Fsecret.txt` and stays inside the root.
    const res = await fetch(`${base}/api/image?path=%252E%252E%252Foutside%252Fsecret.txt`);
    expect(res.status).toBe(200);
    expect(await res.json()).toHaveProperty('error');
    expect(vi.mocked(core.loadImage)).toHaveBeenCalledWith(session, '%2E%2E%2Foutside%2Fsecret.txt');
  });
});

describe('GET /api/attachment', () => {
  it('returns the attachment bytes', async () => {
    const res = await fetch(`${base}/api/attachment?path=attach.bin`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('attachment-bytes');
    expect(vi.mocked(core.readAttachment)).toHaveBeenCalledWith(path.join(root, 'attach.bin'));
  });

  // Attachment paths are a different namespace from diff paths: review.xml
  // records `.self-review-assets/<name>` relative to the *output file's*
  // directory, which is only the repository root by coincidence. Rooting them
  // at the repository 404s every resumed image as soon as the review runs from
  // a subdirectory or with -o elsewhere, which the desktop does not do.
  it('resolves an attachment against the output directory, not the repository', async () => {
    const outDir = path.join(root, 'out');
    fs.mkdirSync(path.join(outDir, '.self-review-assets'), { recursive: true });
    fs.writeFileSync(path.join(outDir, '.self-review-assets', 'shot.png'), 'REAL-BYTES');
    const previous = session.outputPathInfo;
    session.outputPathInfo = {
      resolvedOutputPath: path.join(outDir, 'review.xml'),
      outputPathWritable: true,
    };

    try {
      const res = await fetch(`${base}/api/attachment?path=.self-review-assets%2Fshot.png`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('REAL-BYTES');
    } finally {
      session.outputPathInfo = previous;
    }
  });

  it('still refuses a traversal out of the output directory', async () => {
    const res = await fetch(`${base}/api/attachment?path=..%2F..%2Foutside%2Fsecret.txt`);
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain('secret');
  });

  it('returns 404 for a contained path that does not exist', async () => {
    const res = await fetch(`${base}/api/attachment?path=missing.bin`);
    expect(res.status).toBe(404);
  });

  it('rejects a traversal path with 400 before reaching core', async () => {
    const res = await fetch(`${base}/api/attachment?path=${encodeURIComponent('../outside/secret.txt')}`);
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });
});

describe('POST /api/expand-context', () => {
  it('passes a valid body to core and returns its result', async () => {
    const expanded = { hunks: [INDEX_HUNK], totalLines: 1 };
    vi.mocked(core.expandContext).mockResolvedValueOnce(expanded);
    const res = await postJson('/api/expand-context', { filePath: 'src/index.ts', contextLines: 10 });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expanded);
    expect(vi.mocked(core.expandContext)).toHaveBeenCalledWith(session, {
      filePath: 'src/index.ts',
      contextLines: 10,
    });
  });

  it('rejects a non-integer contextLines with 400 before reaching core', async () => {
    const res = await postJson('/api/expand-context', { filePath: 'src/index.ts', contextLines: 1.5 });
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects an out-of-bounds contextLines with 400 before reaching core', async () => {
    const res = await postJson('/api/expand-context', { filePath: 'src/index.ts', contextLines: 100_000 });
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects an unknown field with 400 before reaching core', async () => {
    const res = await postJson('/api/expand-context', {
      filePath: 'src/index.ts',
      contextLines: 3,
      cwd: '/',
    });
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects a traversal filePath with 400 before reaching core', async () => {
    const res = await postJson('/api/expand-context', {
      filePath: '../outside/secret.txt',
      contextLines: 3,
    });
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects a body that is not JSON with 400 before reaching core', async () => {
    const res = await postJson('/api/expand-context', null, { body: '{not json' });
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects a body that is not declared application/json with 415', async () => {
    const res = await postJson('/api/expand-context', { filePath: 'src/index.ts', contextLines: 3 }, {
      headers: { 'content-type': 'text/plain' },
    });
    expect(res.status).toBe(415);
    expectNoCoreCall();
  });

  it('rejects a body over the size cap with 413 before reaching core', async () => {
    const res = await postJson('/api/expand-context', {
      filePath: 'x'.repeat(1024 * 1024),
      contextLines: 3,
    });
    expect(res.status).toBe(413);
    expectNoCoreCall();
  });
});

describe('POST /api/review', () => {
  const state: ReviewState = {
    timestamp: '2026-09-09T00:00:00.000Z',
    source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
    files: [{ path: 'src/index.ts', changeType: 'added', viewed: true, comments: [] }],
  };

  it('stores a valid review state on the session', async () => {
    const res = await postJson('/api/review', state);
    expect(res.status).toBe(200);
    expect(vi.mocked(core.submitReviewState)).toHaveBeenCalledWith(session, state);
    expect(session.reviewState).toEqual(state);
  });

  it('rejects a malformed body with 400 before reaching core', async () => {
    const res = await postJson('/api/review', { ...state, files: 'none' });
    expect(res.status).toBe(400);
    expectNoCoreCall();
    expect(session.reviewState).toBeNull();
  });

  it('rejects an unknown field with 400 before reaching core', async () => {
    const res = await postJson('/api/review', { ...state, remoteUrl: 'https://x/pull/1' });
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  // The serializer names each attachment file after the id of the comment
  // that owns it, and writes it before the document is validated against the
  // XSD — so an id was a path, and a rejected document still left the file
  // behind. Core contains that write; this is the half that stops the
  // document at the door.
  function stateWithCommentId(id: unknown) {
    return {
      ...state,
      files: [
        {
          path: 'src/index.ts',
          changeType: 'added',
          viewed: true,
          comments: [{ id, filePath: 'src/index.ts', body: 'x', category: 'bug' }],
        },
      ],
    };
  }

  it('rejects a comment id that could name a path', async () => {
    const res = await postJson('/api/review', stateWithCommentId('../../pwned'));
    expect(res.status).toBe(400);
    expectNoCoreCall();
    expect(session.reviewState).toBeNull();
  });

  it('rejects a comment id that is not a string', async () => {
    const res = await postJson('/api/review', stateWithCommentId({ toString: 'x' }));
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects a traversing reply id', async () => {
    const res = await postJson('/api/review', {
      ...state,
      files: [
        {
          path: 'src/index.ts',
          changeType: 'added',
          viewed: true,
          comments: [
            {
              id: 'c1',
              filePath: 'src/index.ts',
              body: 'x',
              category: 'bug',
              replies: [{ id: '../../pwned', body: 'y' }],
            },
          ],
        },
      ],
    });
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('accepts the two id shapes this application produces', async () => {
    // crypto.randomUUID() from the renderer, and generateId() from core's
    // xml-parser for every comment read back out of a resumed document.
    for (const id of ['3f1a7c2e-9b45-4d8a-8e21-5c6f0a9b7d33', '1757400000000-k3f9a2z']) {
      const res = await postJson('/api/review', stateWithCommentId(id));
      expect(res.status).toBe(200);
    }
  });

  // `Attachment.data` is an ArrayBuffer and `JSON.stringify` renders one as
  // `{}`, so an unencoded blob would reach the serializer empty and write a
  // zero-byte image with a 200 and no error. The client base64-encodes it;
  // what matters here is that non-empty bytes come out the other end.
  const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function stateWithAttachment(attachment: unknown) {
    return {
      ...state,
      files: [
        {
          path: 'src/index.ts',
          changeType: 'added',
          viewed: true,
          comments: [
            {
              id: 'c1',
              filePath: 'src/index.ts',
              lineRange: null,
              body: 'see the screenshot',
              category: 'bug',
              suggestion: null,
              attachments: [attachment],
            },
          ],
        },
      ],
    };
  }

  it('delivers non-empty attachment bytes to submitReviewState', async () => {
    const res = await postJson(
      '/api/review',
      stateWithAttachment({
        id: 'a1',
        fileName: 'shot.png',
        mediaType: 'image/png',
        dataBase64: Buffer.from(BYTES).toString('base64'),
      })
    );
    expect(res.status).toBe(200);

    const submitted = vi.mocked(core.submitReviewState).mock.calls[0][1];
    const data = submitted.files[0].comments[0].attachments![0].data!;
    expect(new Uint8Array(data)).toEqual(BYTES);
    // And the session holds the same bytes, which is what lifecycle writes.
    expect(
      new Uint8Array(session.reviewState!.files[0].comments[0].attachments![0].data!)
    ).toEqual(BYTES);
  });

  it('refuses a raw ArrayBuffer field instead of writing an empty file', async () => {
    const res = await postJson('/api/review', stateWithAttachment({
      id: 'a1',
      fileName: 'shot.png',
      mediaType: 'image/png',
      data: {},
    }));
    expect(res.status).toBe(400);
    expectNoCoreCall();
    expect(session.reviewState).toBeNull();
  });
});

describe('routing', () => {
  it('returns 404 for an unknown API route', async () => {
    const res = await fetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });

  it('returns 405 for a known path with the wrong method', async () => {
    const res = await fetch(`${base}/api/diff`, { method: 'POST' });
    expect(res.status).toBe(405);
    expectNoCoreCall();
  });
});

describe('static assets', () => {
  it('serves index.html at /', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('<title>self-review</title>');
  });

  it('serves a bundled asset with its content type', async () => {
    const res = await fetch(`${base}/assets/app.js`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('javascript');
    expect(await res.text()).toBe('console.log("app");\n');
  });

  it('returns 404 for a missing asset', async () => {
    const res = await fetch(`${base}/assets/missing.js`);
    expect(res.status).toBe(404);
  });

  it('refuses a traversal out of the client directory', async () => {
    // An encoded separator survives URL normalisation, so the decoded path
    // is `../../outside/secret.txt` relative to the client directory.
    const res = await fetch(`${base}/..%2F..%2Foutside%2Fsecret.txt`);
    expect(res.status).toBe(404);
    expect(await res.text()).not.toContain('secret');
  });
});

// Binding to loopback keeps other machines out. It does not keep out a web
// page: a name the attacker controls, re-resolved to 127.0.0.1 after the page
// has loaded, is same-origin with this server as far as the browser is
// concerned, and every route becomes reachable from a site the reviewer
// merely visited. What distinguishes that request from a real one is the
// header naming who it thinks it is talking to.
describe('host and origin', () => {
  it('rejects a request whose Host names another site', async () => {
    const res = await rawGet('/api/diff', { host: 'evil.attacker.com' });
    expect(res.status).toBe(403);
    expectNoCoreCall();
    expect(res.body).not.toContain('index.ts');
  });

  // A forwarded port is the reason this package exists — `ssh -L`, `docker
  // run -p` — and the forward's port is what lands in `Host`. Comparing that
  // to the port this process bound would 403 every remote-box review, so the
  // port is deliberately not checked. It protects nothing: a rebound request
  // is refused on the attacker's hostname before any port is considered.
  it('answers through a port forward, where Host names the forward', async () => {
    const res = await rawGet('/api/diff', { host: '127.0.0.1:9999' });
    expect(res.status).toBe(200);
  });

  // What replaces the port check: the Origin has to be the same authority the
  // request addresses. A page served by some other local process — a dev
  // server on :3000 — sends its own origin and this listener's host, and
  // 'localhost' being loopback in both is not enough to let it through.
  it('rejects a page served from another local port', async () => {
    const { port } = server.address() as AddressInfo;
    const res = await rawGet('/api/diff', {
      host: `127.0.0.1:${port}`,
      origin: 'http://localhost:3000',
    });
    expect(res.status).toBe(403);
    expectNoCoreCall();
  });

  it('accepts an Origin that matches a forwarded Host', async () => {
    const res = await rawGet('/api/diff', {
      host: 'localhost:9999',
      origin: 'http://localhost:9999',
    });
    expect(res.status).toBe(200);
  });

  it('rejects a duplicate Host header', async () => {
    // Node resolves duplicates to the first; an intermediary forwarding the
    // last would then be reading a different request from the approved one.
    const { port } = server.address() as AddressInfo;
    const res = await rawGetRaw(
      `GET /api/diff HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nHost: evil.attacker.com\r\nConnection: close\r\n\r\n`
    );
    expect(res).toContain('403');
  });

  it('rejects an Origin that is not a serialized origin', async () => {
    // `new URL` parses userinfo away, so this would otherwise compare equal to
    // the listener's own authority. A browser never sends such a value.
    const { port } = server.address() as AddressInfo;
    const res = await rawGet('/api/diff', {
      host: `127.0.0.1:${port}`,
      origin: `http://evil.attacker.com@127.0.0.1:${port}`,
    });
    expect(res.status).toBe(403);
    expectNoCoreCall();
  });

  it('rejects a request the browser marks as cross-site', async () => {
    // A cross-site GET — an <img> or <script> aimed at this port — carries no
    // Origin, so this header is the only thing that identifies it.
    const { port } = server.address() as AddressInfo;
    const res = await rawGet('/api/diff', {
      host: `127.0.0.1:${port}`,
      'sec-fetch-site': 'cross-site',
    });
    expect(res.status).toBe(403);
    expectNoCoreCall();
  });

  it('accepts the fetch metadata a real page sends', async () => {
    const { port } = server.address() as AddressInfo;
    for (const site of ['same-origin', 'none']) {
      const res = await rawGet('/api/diff', {
        host: `127.0.0.1:${port}`,
        'sec-fetch-site': site,
      });
      expect(res.status).toBe(200);
    }
  });

  it('answers a Host that names this listener', async () => {
    const { port } = server.address() as AddressInfo;
    const res = await rawGet('/api/diff', { host: `127.0.0.1:${port}` });
    expect(res.status).toBe(200);
  });

  it('rejects a cross-origin submission before it reaches core', async () => {
    const res = await postJson(
      '/api/review',
      {
        timestamp: '2026-09-09T00:00:00.000Z',
        source: { type: 'git', gitDiffArgs: '--staged', repository: '/repo' },
        files: [],
      },
      { headers: { 'content-type': 'application/json', origin: 'https://evil.attacker.com' } }
    );
    expect(res.status).toBe(403);
    expectNoCoreCall();
    expect(session.reviewState).toBeNull();
  });

  it('rejects an https origin on a matching authority', async () => {
    const { port } = server.address() as AddressInfo;
    const res = await rawGet('/api/diff', {
      host: `127.0.0.1:${port}`,
      origin: `https://127.0.0.1:${port}`,
    });
    expect(res.status).toBe(403);
  });

  it('rejects the opaque origin a sandboxed frame sends', async () => {
    const res = await fetch(`${base}/api/diff`, { headers: { origin: 'null' } });
    expect(res.status).toBe(403);
    expectNoCoreCall();
  });

  it('accepts localhost and the listener\'s own origin', async () => {
    const port = (server.address() as AddressInfo).port;
    const viaLocalhost = await fetch(`http://localhost:${port}/api/diff`);
    expect(viaLocalhost.status).toBe(200);

    const withOrigin = await fetch(`${base}/api/diff`, { headers: { origin: base } });
    expect(withOrigin.status).toBe(200);
  });

  it('accepts a request with no Origin at all, as curl sends', async () => {
    const res = await fetch(`${base}/api/diff`);
    expect(res.status).toBe(200);
  });
});

// The page renders the diff under review, which is the least trusted input
// this program handles. These headers are the layer that holds when the
// renderer's own sanitizing does not.
describe('security headers', () => {
  it('sends a CSP that forbids frames, plugins and foreign origins', async () => {
    const res = await fetch(`${base}/`);
    const csp = res.headers.get('content-security-policy') ?? '';
    expect(csp).toContain("frame-src 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("script-src 'self'");
    expect(csp).toContain("connect-src 'self'");
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
    expect(res.headers.get('x-frame-options')).toBe('DENY');
  });

  it('sends them on API responses too', async () => {
    const res = await fetch(`${base}/api/diff`);
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});
