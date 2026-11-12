import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import * as http from 'http';
import * as net from 'net';
import { Worker } from 'node:worker_threads';
import { JsonBodyProcessing } from './json-body-processing';
import type { AddressInfo } from 'net';
import * as core from '@self-review/core';
import type { DiffFile, ReviewSession, ReviewState, AppConfig } from '@self-review/core';
import { createReviewServer, listenLoopback } from './server';

import { buildJsonBodyTestWorker } from './test-support/json-body-worker';

import { createReviewOperations } from './review-operations';

// Fixture layout — real paths, so containment is checked against a real tree:
//
//   <tmp>/
//     outside/secret.txt
//     repo/
//       src/index.ts
//       img.png
//       .self-review-assets/attach.bin
//     client/
//       index.html
//       assets/app.js
let jsonWorker: Awaited<ReturnType<typeof buildJsonBodyTestWorker>>;
beforeAll(async () => {
  jsonWorker = await buildJsonBodyTestWorker();
});
afterAll(async () => {
  await jsonWorker.processing.shutdown();
  await jsonWorker.cleanup();
});
let tmp: string;
let root: string;
let clientDir: string;
let session: ReviewSession;
let operations: ReturnType<typeof createReviewOperations>;
let server: ReturnType<typeof createReviewServer>;
let base: string;

// Fixed so a test can also present one that is wrong by a single character.
const CAPABILITY = 'test-capability-0123456789abcdefghijklmnopqrstuvwxyz';
const AUTH = { authorization: `Bearer ${CAPABILITY}` };

function apiFetch(url: string, init: RequestInit = {}): Promise<Response> {
  return fetch(url, { ...init, headers: { ...AUTH, ...(init.headers as Record<string, string>) } });
}

const OPERATION_SPIES = [
  'getDiffLoad',
  'getConfigLoad',
  'getResumeLoad',
  'getFileHunks',
  'loadImage',
  'readAttachment',
  'expandContext',
  'submitReviewState',
  'applySuggestionForSession',
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
  lines: [{ type: 'addition', content: 'export {};', oldLineNumber: null, newLineNumber: 1 }],
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

const ATTACH = '.self-review-assets%2Fattach.bin';

const LITERAL_NAME = '%2E%2E%2Fliteral.png';

function freshSession(): ReviewSession {
  const s = core.createReviewSession();
  // Committed through core to capture the reviewed paths and identity the routes authorize against.
  core.commitDiffData(
    s,
    {
      source: { type: 'git', gitDiffArgs: '', repository: root },
      files: [diffFile('src/index.ts', [INDEX_HUNK]), diffFile('img.png'), diffFile(LITERAL_NAME)],
    },
    {
      mode: 'git',
      sourceRoot: root,
      invocationCwd: root,
      gitDiffArgv: [],
      pathPrefix: '',
      oldSide: { kind: 'index' },
      newSide: { kind: 'working-tree' },
    }
  );
  s.guideData = { overview: 'Start with the entry point.', groups: [] };
  s.config = CONFIG;
  s.outputPathInfo = {
    resolvedOutputPath: path.join(root, 'review.xml'),
    outputPathWritable: true,
  };
  return s;
}

function expectNoCoreCall() {
  for (const name of OPERATION_SPIES) {
    expect(vi.mocked(operations[name]), name).not.toHaveBeenCalled();
  }
}

async function postJson(route: string, body: unknown, init: RequestInit = {}) {
  return fetch(base + route, {
    method: 'POST',
    body: JSON.stringify(body),
    ...init,
    headers: {
      'content-type': 'application/json',
      ...AUTH,
      ...(init.headers as Record<string, string>),
    },
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
  headers: Record<string, string>,
  { withCapability = true } = {}
): Promise<{ status: number; body: string }> {
  const { port } = server.address() as AddressInfo;
  const sent = withCapability ? { ...AUTH, ...headers } : headers;
  return new Promise((resolve, reject) => {
    const req = http.request(
      { host: '127.0.0.1', port, path: routePath, method: 'GET', headers: sent },
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
  fs.writeFileSync(path.join(root, LITERAL_NAME), Buffer.from([0x4c, 0x49, 0x54]));
  fs.mkdirSync(path.join(root, '.self-review-assets'));
  fs.writeFileSync(
    path.join(root, '.self-review-assets', 'attach.bin'),
    Buffer.from('attachment-bytes')
  );
  fs.mkdirSync(path.join(tmp, 'outside'));
  fs.writeFileSync(path.join(tmp, 'outside', 'secret.txt'), 'secret\n');
  fs.mkdirSync(path.join(clientDir, 'assets'), { recursive: true });
  fs.writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html><title>self-review</title>');
  fs.writeFileSync(path.join(clientDir, 'assets', 'app.js'), 'console.log("app");\n');
});

afterAll(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

beforeEach(async () => {
  session = freshSession();
  const output = { path: path.join(root, 'review.xml'), origin: 'explicit' as const };
  operations = createReviewOperations(session, output);
  for (const name of OPERATION_SPIES) vi.spyOn(operations, name);
  server = createReviewServer({
    session,
    clientDir,
    output,
    capability: CAPABILITY,
    operations,
    jsonBodyProcessing: new JsonBodyProcessing(() => new Worker(jsonWorker.path)),
  });
  const { port } = await listenLoopback(server, 0);
  base = `http://127.0.0.1:${port}`;
});

afterEach(async () => {
  server.closeAllConnections();
  await new Promise<void>(resolve => server.close(() => resolve()));
});

describe('listener', () => {
  it('binds to 127.0.0.1 only', () => {
    const address = server.address() as AddressInfo;
    expect(address.address).toBe('127.0.0.1');
  });
});

describe('GET /api/diff', () => {
  it('returns the diff and the guide in one response', async () => {
    const res = await apiFetch(`${base}/api/diff`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('application/json');
    const body = await res.json();
    expect(body.diff.files.map((f: DiffFile) => f.newPath)).toEqual([
      'src/index.ts',
      'img.png',
      LITERAL_NAME,
    ]);
    expect(body.diff.source).toEqual(session.diffData!.source);
    expect(body.guide).toEqual({ overview: 'Start with the entry point.', groups: [] });
    expect(vi.mocked(operations.getDiffLoad)).toHaveBeenCalledWith();
  });
});

describe('GET /api/config', () => {
  it('returns the config and the output path info', async () => {
    const res = await apiFetch(`${base}/api/config`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.config.theme).toBe('dark');
    expect(body.outputPathInfo).toEqual(session.outputPathInfo);
    expect(vi.mocked(operations.getConfigLoad)).toHaveBeenCalledWith();
  });
});

describe('GET /api/resume', () => {
  it('returns null when there is nothing to resume', async () => {
    const res = await apiFetch(`${base}/api/resume`);
    expect(res.status).toBe(200);
    expect(await res.json()).toBeNull();
  });

  it('returns the resumed comments and viewed files', async () => {
    session.resumeViewedFiles = ['src/index.ts'];
    const res = await apiFetch(`${base}/api/resume`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ comments: [], viewedFiles: ['src/index.ts'] });
    expect(vi.mocked(operations.getResumeLoad)).toHaveBeenCalledWith();
  });
});

describe('GET /api/file', () => {
  it('returns the hunks of a file in the diff', async () => {
    const res = await apiFetch(`${base}/api/file?path=${encodeURIComponent('src/index.ts')}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual([INDEX_HUNK]);
    expect(vi.mocked(operations.getFileHunks)).toHaveBeenCalledWith('src/index.ts');
  });

  it('rejects a path the review does not contain with 400 before reaching core', async () => {
    const res = await apiFetch(`${base}/api/file?path=src/other.ts`);
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects a traversal path with 400 before reaching core', async () => {
    const res = await apiFetch(
      `${base}/api/file?path=${encodeURIComponent('../outside/secret.txt')}`
    );
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects a missing path parameter with 400 before reaching core', async () => {
    const res = await apiFetch(`${base}/api/file`);
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });
});

describe('GET /api/image', () => {
  it('returns the image as a data URI', async () => {
    const res = await apiFetch(`${base}/api/image?path=img.png`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.dataUri).toBe(
      `data:image/png;base64,${Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString('base64')}`
    );
    expect(vi.mocked(operations.loadImage)).toHaveBeenCalledWith('img.png', {
      signal: expect.any(AbortSignal),
    });
  });

  it('rejects a traversal path with 400 before reaching core', async () => {
    const res = await apiFetch(
      `${base}/api/image?path=${encodeURIComponent('../outside/secret.txt')}`
    );
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('treats a whole-path-encoded traversal as a literal filename inside the root', async () => {
    // Decoded exactly once: `%252E%252E%252Fliteral.png` arrives as the literal filename `%2E%2E%2Fliteral.png`.
    const res = await apiFetch(`${base}/api/image?path=%252E%252E%252Fliteral.png`);
    expect(res.status).toBe(200);
    expect((await res.json()).dataUri).toBe(
      `data:image/png;base64,${Buffer.from([0x4c, 0x49, 0x54]).toString('base64')}`
    );
    expect(vi.mocked(operations.loadImage)).toHaveBeenCalledWith(LITERAL_NAME, {
      signal: expect.any(AbortSignal),
    });
  });

  it('rejects a path the review does not contain with 400 before reaching core', async () => {
    const res = await apiFetch(`${base}/api/image?path=src/index.png`);
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });
});

describe('GET /api/attachment', () => {
  it('returns the attachment bytes', async () => {
    const res = await apiFetch(`${base}/api/attachment?path=${ATTACH}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(Buffer.from(await res.arrayBuffer()).toString()).toBe('attachment-bytes');
    expect(vi.mocked(operations.readAttachment)).toHaveBeenCalledWith(
      '.self-review-assets/attach.bin',
      { signal: expect.any(AbortSignal) }
    );
  });

  // Attachment paths are a different namespace from diff paths: review.xml
  // records `.self-review-assets/<name>` relative to the *output file's*
  // directory, which is only the repository root by coincidence. Rooting them
  // at the repository 404s every resumed image as soon as the review runs from
  // a subdirectory or with -o elsewhere.
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
      const res = await apiFetch(`${base}/api/attachment?path=.self-review-assets%2Fshot.png`);
      expect(res.status).toBe(200);
      expect(await res.text()).toBe('REAL-BYTES');
    } finally {
      session.outputPathInfo = previous;
    }
  });

  it('serves a resumed attachment from beside the resumed document', async () => {
    const docDir = path.join(tmp, 'resumed-from');
    fs.mkdirSync(path.join(docDir, '.self-review-assets'), { recursive: true });
    fs.writeFileSync(path.join(docDir, '.self-review-assets', 'attach.bin'), 'RESUMED-BYTES');
    core.recordResumedAttachments(
      session,
      [
        {
          id: 'c1',
          filePath: 'src/index.ts',
          lineRange: null,
          body: 'see',
          category: 'note',
          suggestion: null,
          attachments: [
            { id: 'a', fileName: '.self-review-assets/attach.bin', mediaType: 'image/png' },
          ],
        },
      ],
      path.join(docDir, 'review.xml')
    );

    const res = await apiFetch(`${base}/api/attachment?path=${ATTACH}`);
    expect(res.status).toBe(200);
    expect(await res.text()).toBe('RESUMED-BYTES');
  });

  it('refuses a symlink in the asset directory', async () => {
    const link = path.join(root, '.self-review-assets', 'link.png');
    fs.symlinkSync(path.join(tmp, 'outside', 'secret.txt'), link);
    try {
      const res = await apiFetch(`${base}/api/attachment?path=.self-review-assets%2Flink.png`);
      expect(res.status).toBe(400);
      expect(await res.text()).not.toContain('secret');
    } finally {
      fs.unlinkSync(link);
    }
  });

  it('returns 404 for an attachment that does not exist', async () => {
    const res = await apiFetch(`${base}/api/attachment?path=.self-review-assets%2Fmissing.bin`);
    expect(res.status).toBe(404);
  });

  it.each([
    '../outside/secret.txt',
    '..%2F..%2Foutside%2Fsecret.txt',
    '/etc/passwd',
    'attach.bin',
    '.self-review-assets/../../outside/secret.txt',
  ])('rejects %s with 400 before reaching core', async raw => {
    const res = await apiFetch(`${base}/api/attachment?path=${encodeURIComponent(raw)}`);
    expect(res.status).toBe(400);
    expect(await res.text()).not.toContain('secret');
    expectNoCoreCall();
  });
});

describe('POST /api/expand-context', () => {
  it('passes a valid body to core and returns its result', async () => {
    const expanded = { hunks: [INDEX_HUNK], totalLines: 1 };
    vi.mocked(operations.expandContext).mockResolvedValueOnce(expanded);
    const res = await postJson('/api/expand-context', {
      filePath: 'src/index.ts',
      contextLines: 10,
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(expanded);
    expect(vi.mocked(operations.expandContext)).toHaveBeenCalledWith(
      {
        filePath: 'src/index.ts',
        contextLines: 10,
      },
      { signal: expect.any(AbortSignal) }
    );
  });

  it('rejects a non-integer contextLines with 400 before reaching core', async () => {
    const res = await postJson('/api/expand-context', {
      filePath: 'src/index.ts',
      contextLines: 1.5,
    });
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it('rejects an out-of-bounds contextLines with 400 before reaching core', async () => {
    const res = await postJson('/api/expand-context', {
      filePath: 'src/index.ts',
      contextLines: 100_000,
    });
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
    const res = await postJson(
      '/api/expand-context',
      { filePath: 'src/index.ts', contextLines: 3 },
      {
        headers: { 'content-type': 'text/plain' },
      }
    );
    expect(res.status).toBe(415);
    expectNoCoreCall();
  });

  it.each([
    'application/jsonp',
    'application/json-seq',
    'application/json+custom',
    'application/json garbage',
  ])('refuses the different media type %s before reaching core', async contentType => {
    const res = await postJson(
      '/api/expand-context',
      { filePath: 'src/index.ts', contextLines: 3 },
      { headers: { 'content-type': contentType } }
    );
    expect(res.status).toBe(415);
    expectNoCoreCall();
  });

  it.each([
    'application/json; charset=utf-8',
    'Application/JSON; Charset=UTF-8',
    'application/json ; charset=utf-8',
  ])('accepts the JSON media type with supported parameters: %s', async contentType => {
    const res = await postJson(
      '/api/expand-context',
      { filePath: 'src/index.ts', contextLines: 3 },
      { headers: { 'content-type': contentType } }
    );
    expect(res.status).toBe(200);
    expect(operations.expandContext).toHaveBeenCalledOnce();
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

  beforeEach(() => {
    state.source = session.diffData!.source;
  });

  it('records a valid review state and acknowledges it only once it is published', async () => {
    const outputPath = path.join(root, 'review.xml');
    fs.rmSync(outputPath, { force: true });

    const res = await postJson('/api/review', state);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, outputPath });
    expect(vi.mocked(operations.submitReviewState)).toHaveBeenCalledWith(state);
    expect(session.reviewState).toEqual(state);
    expect(fs.readFileSync(outputPath, 'utf-8')).toContain('urn:self-review:v3');
  });

  it('copies a resumed attachment beside an output in another directory', async () => {
    const outputPath = path.join(root, 'review.xml');
    fs.rmSync(outputPath, { force: true });
    const docDir = path.join(tmp, 'resumed-for-publish');
    fs.mkdirSync(path.join(docDir, '.self-review-assets'), { recursive: true });
    fs.writeFileSync(path.join(docDir, '.self-review-assets', 'r.png'), 'RESUMED-PNG');
    const comment = {
      id: 'c1',
      filePath: 'src/index.ts',
      lineRange: null,
      body: 'see',
      category: 'note',
      suggestion: null,
      attachments: [{ id: 'a', fileName: '.self-review-assets/r.png', mediaType: 'image/png' }],
    };
    core.recordResumedAttachments(session, [comment], path.join(docDir, 'review.xml'));

    const res = await postJson('/api/review', {
      ...state,
      files: [{ ...state.files[0], comments: [comment] }],
    });

    expect(res.status).toBe(200);
    const [published] = core.parseReviewXml(outputPath).comments;
    const reference = published.attachments![0].fileName;
    expect(reference).toMatch(/^\.self-review-assets\/c1-.+\.png$/);
    expect(fs.readFileSync(path.join(root, reference), 'utf-8')).toBe('RESUMED-PNG');
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

  it.each(['3f1a7c2e-9b45-4d8a-8e21-5c6f0a9b7d33', '1757400000000-abc123'])(
    'accepts the application id %s',
    async id => {
      const res = await postJson('/api/review', stateWithCommentId(id));
      expect(res.status).toBe(200);
    }
  );

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

    const submitted = vi.mocked(operations.submitReviewState).mock.calls[0][0];
    const data = submitted.files[0].comments[0].attachments![0].data!;
    expect(new Uint8Array(data)).toEqual(BYTES);
    // And the session holds the same bytes, which is what lifecycle writes.
    expect(new Uint8Array(session.reviewState!.files[0].comments[0].attachments![0].data!)).toEqual(
      BYTES
    );
  });

  it('refuses a raw ArrayBuffer field instead of writing an empty file', async () => {
    const res = await postJson(
      '/api/review',
      stateWithAttachment({
        id: 'a1',
        fileName: 'shot.png',
        mediaType: 'image/png',
        data: {},
      })
    );
    expect(res.status).toBe(400);
    expectNoCoreCall();
    expect(session.reviewState).toBeNull();
  });
});

// The one route that rewrites a file in the reviewed tree, so the shape is
// checked exactly rather than deferred to core.
describe('POST /api/apply-suggestion', () => {
  const request = {
    filePath: 'src/index.ts',
    lineRange: { side: 'new', start: 1, end: 1 },
    suggestion: { originalCode: 'export {};', proposedCode: 'export const a = 1;' },
  };

  it('accepts source text beyond 64 KiB and leaves refusal to the core Apply checks', async () => {
    const res = await postJson('/api/apply-suggestion', {
      filePath: 'src/index.ts',
      lineRange: { side: 'new', start: 1, end: 1 },
      suggestion: { originalCode: 'export {};', proposedCode: 'x'.repeat(70 * 1024) },
    });
    expect(res.status).toBe(200);
    expect(vi.mocked(operations.applySuggestionForSession)).toHaveBeenCalledTimes(1);
  });

  it('reaches core with a well-formed request', async () => {
    const res = await postJson('/api/apply-suggestion', request);
    expect(res.status).toBe(200);
    expect(vi.mocked(operations.applySuggestionForSession)).toHaveBeenCalledTimes(1);
  });

  it('refuses a path outside the repository before core runs', async () => {
    const res = await postJson('/api/apply-suggestion', {
      ...request,
      filePath: '../outside/secret.txt',
    });
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  it.each([
    ['unknown field', { ...request, destination: '/tmp' }],
    ['missing filePath', { ...request, filePath: '' }],
    ['bad side', { ...request, lineRange: { side: 'sideways', start: 1, end: 1 } }],
    ['unknown lineRange field', { ...request, lineRange: { side: 'new', start: 1, end: 1, x: 1 } }],
    ['non-string code', { ...request, suggestion: { originalCode: 1, proposedCode: 'x' } }],
    ['unknown suggestion field', { ...request, suggestion: { ...request.suggestion, z: 1 } }],
  ])('rejects %s with 400 before core runs', async (_label, body) => {
    const res = await postJson('/api/apply-suggestion', body);
    expect(res.status).toBe(400);
    expectNoCoreCall();
  });

  // A file-level comment has no anchor. Core refuses it in its own vocabulary,
  // which is more useful to the reviewer than a 400 from the door.
  it('passes a null lineRange through to core', async () => {
    const res = await postJson('/api/apply-suggestion', { ...request, lineRange: null });
    expect(res.status).toBe(200);
    expect(vi.mocked(operations.applySuggestionForSession)).toHaveBeenCalledTimes(1);
  });
});

describe('routing', () => {
  it('returns 404 for an unknown API route', async () => {
    const res = await apiFetch(`${base}/api/nope`);
    expect(res.status).toBe(404);
    expect(await res.json()).toHaveProperty('error');
  });

  it('returns 405 for a known path with the wrong method', async () => {
    const res = await apiFetch(`${base}/api/diff`, { method: 'POST' });
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
      `GET /api/diff HTTP/1.1\r\nHost: 127.0.0.1:${port}\r\nHost: evil.attacker.com\r\n` +
        `Authorization: Bearer ${CAPABILITY}\r\nConnection: close\r\n\r\n`
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
    const res = await apiFetch(`${base}/api/diff`, { headers: { origin: 'null' } });
    expect(res.status).toBe(403);
    expectNoCoreCall();
  });

  it("accepts localhost and the listener's own origin", async () => {
    const port = (server.address() as AddressInfo).port;
    const viaLocalhost = await apiFetch(`http://localhost:${port}/api/diff`);
    expect(viaLocalhost.status).toBe(200);

    const withOrigin = await apiFetch(`${base}/api/diff`, { headers: { origin: base } });
    expect(withOrigin.status).toBe(200);
  });

  it('accepts a request with no Origin at all, as curl sends', async () => {
    const res = await apiFetch(`${base}/api/diff`);
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
    const res = await apiFetch(`${base}/api/diff`);
    expect(res.headers.get('content-security-policy')).toBeTruthy();
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });
});

// Host/Origin/Fetch Metadata keep a web page out, not another local process; the capability does.
describe('session capability', () => {
  const SENSITIVE_GETS = ['/api/diff', '/api/config', '/api/resume', '/api/file', '/api/image'];
  const SENSITIVE_POSTS = ['/api/expand-context', '/api/apply-suggestion', '/api/review'];

  it.each(SENSITIVE_GETS)('refuses GET %s without the capability', async route => {
    const res = await fetch(`${base}${route}?path=img.png`);
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: 'unauthorized' });
    expectNoCoreCall();
  });

  it('refuses GET /api/attachment without the capability', async () => {
    const res = await fetch(`${base}/api/attachment?path=${ATTACH}`);
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain('attachment-bytes');
    expectNoCoreCall();
  });

  it.each(SENSITIVE_POSTS)('refuses POST %s without the capability', async route => {
    const res = await fetch(`${base}${route}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{}',
    });
    expect(res.status).toBe(401);
    expectNoCoreCall();
    expect(session.reviewState).toBeNull();
  });

  it.each([
    ['a wrong token of the same length', CAPABILITY.slice(0, -1) + '!'],
    ['a prefix of the token', CAPABILITY.slice(0, -1)],
    ['the token with a suffix', CAPABILITY + 'x'],
    ['an empty bearer', ''],
  ])('refuses %s', async (_label, presented) => {
    const res = await fetch(`${base}/api/diff`, {
      headers: { authorization: `Bearer ${presented}` },
    });
    expect(res.status).toBe(401);
    expectNoCoreCall();
  });

  it('refuses a scheme other than Bearer, even carrying the token', async () => {
    const res = await fetch(`${base}/api/diff`, {
      headers: { authorization: `Basic ${CAPABILITY}` },
    });
    expect(res.status).toBe(401);
    expectNoCoreCall();
  });

  it('refuses the token as a query parameter, which would land in logs and history', async () => {
    const res = await fetch(`${base}/api/diff?cap=${CAPABILITY}`);
    expect(res.status).toBe(401);
    expectNoCoreCall();
  });

  it('never echoes the presented token in a refusal', async () => {
    const res = await fetch(`${base}/api/diff`, {
      headers: { authorization: `Bearer ${CAPABILITY}x` },
    });
    expect(res.status).toBe(401);
    expect(await res.text()).not.toContain(CAPABILITY);
    expect(res.headers.get('www-authenticate')).toBe('Bearer');
  });

  it('answers every sensitive route with the right token', async () => {
    for (const route of [
      '/api/diff',
      '/api/config',
      '/api/resume',
      '/api/file?path=src/index.ts',
    ]) {
      expect((await apiFetch(`${base}${route}`)).status, route).toBe(200);
    }
    expect((await apiFetch(`${base}/api/image?path=img.png`)).status).toBe(200);
    expect((await apiFetch(`${base}/api/attachment?path=${ATTACH}`)).status).toBe(200);
    vi.mocked(operations.expandContext).mockResolvedValueOnce({
      hunks: [INDEX_HUNK],
      totalLines: 1,
    });
    const expanded = await postJson('/api/expand-context', {
      filePath: 'src/index.ts',
      contextLines: 3,
    });
    expect(expanded.status).toBe(200);
    expect(vi.mocked(operations.expandContext)).toHaveBeenCalledTimes(1);
  });

  // The audit's reproduction: `curl -H 'Host: 127.0.0.1:<port>' http://127.0.0.1:<port>/api/diff` from another account.
  it('refuses a request that names this listener in Host but carries no browser headers and no token', async () => {
    const { port } = server.address() as AddressInfo;
    const res = await rawGet('/api/diff', { host: `127.0.0.1:${port}` }, { withCapability: false });
    expect(res.status).toBe(401);
    expect(res.body).not.toContain('index.ts');
    expectNoCoreCall();
  });

  it('refuses an unknown or wrongly-methoded API path before saying which it is', async () => {
    expect((await fetch(`${base}/api/nope`)).status).toBe(401);
    expect((await fetch(`${base}/api/diff`, { method: 'POST' })).status).toBe(401);
  });

  it('checks the browser headers first, so a rebound page learns nothing from the status', async () => {
    const res = await rawGet('/api/diff', { host: 'evil.attacker.com' }, { withCapability: false });
    expect(res.status).toBe(403);
  });

  it('serves the page and its assets without the token, and neither contains it', async () => {
    for (const asset of ['/', '/assets/app.js']) {
      const res = await fetch(`${base}${asset}`);
      expect(res.status, asset).toBe(200);
      expect(await res.text()).not.toContain(CAPABILITY);
    }
  });

  it('sets Referrer-Policy: no-referrer on every kind of response', async () => {
    const page = await fetch(`${base}/`);
    const api = await apiFetch(`${base}/api/diff`);
    const refused = await fetch(`${base}/api/diff`);
    const attachment = await apiFetch(`${base}/api/attachment?path=${ATTACH}`);
    for (const res of [page, api, refused, attachment]) {
      expect(res.headers.get('referrer-policy')).toBe('no-referrer');
    }
  });

  // `ssh -L 9999:127.0.0.1:<port>`: Host carries the forward's port.
  it('is reachable through a local port forward with the capability', async () => {
    const { port } = server.address() as AddressInfo;
    const sockets = new Set<net.Socket>();
    const proxy = net.createServer(client => {
      const upstream = net.connect(port, '127.0.0.1');
      sockets.add(client).add(upstream);
      client.pipe(upstream).pipe(client);
      client.on('error', () => upstream.destroy());
      upstream.on('error', () => client.destroy());
    });
    await new Promise<void>(resolve => proxy.listen(0, '127.0.0.1', resolve));
    const forwardPort = (proxy.address() as AddressInfo).port;
    try {
      const forwarded = `http://127.0.0.1:${forwardPort}`;
      const res = await fetch(`${forwarded}/api/diff`, {
        headers: { ...AUTH, origin: forwarded, 'sec-fetch-site': 'same-origin' },
      });
      expect(res.status).toBe(200);
      expect((await res.json()).diff.files).toHaveLength(3);

      const bare = await fetch(`${forwarded}/api/diff`);
      expect(bare.status).toBe(401);
    } finally {
      // Keep-alive sockets would hold the proxy open for seconds.
      for (const socket of sockets) socket.destroy();
      await new Promise<void>(resolve => proxy.close(() => resolve()));
    }
  });
});

it.each([
  { side: 'new', start: 0, end: 1 },
  { side: 'new', start: 4, end: 2 },
  { side: 'new', start: 1.5, end: 2 },
])('returns the engine refusal for an unusable numeric Apply range: %j', async lineRange => {
  vi.mocked(operations.applySuggestionForSession).mockImplementation(request => ({
    status: 'refused',
    filePath: request.filePath,
    reason: 'invalid-anchor',
    detail: 'invalid range',
  }));
  const response = await postJson('/api/apply-suggestion', {
    filePath: 'src/index.ts',
    lineRange,
    suggestion: { originalCode: 'a', proposedCode: 'b' },
  });
  expect(response.status).toBe(200);
  expect(await response.json()).toMatchObject({ status: 'refused', reason: 'invalid-anchor' });
  expect(operations.applySuggestionForSession).toHaveBeenCalledOnce();
});

it.each([
  { type: 'git', gitDiffArgs: '--staged', repository: '/other' },
  { type: 'git', gitDiffArgs: '--staged', repository: 'loaded' },
  { type: 'directory', sourcePath: '/other' },
  { type: 'file', sourcePath: '/other' },
  { type: 'welcome' },
  { type: 'loading' },
])(
  'refuses foreign publication source %j before caching or publishing and permits repair',
  async source => {
    const previous: ReviewState = {
      timestamp: '2026-01-01T00:00:00Z',
      source: session.diffData!.source,
      files: [],
    };
    session.reviewState = previous;
    const outputPath = path.join(root, 'review.xml');
    fs.writeFileSync(outputPath, 'previous document');
    const assets = fs.readdirSync(path.join(root, '.self-review-assets'));
    const publisher = vi.spyOn(operations, 'publishReview');
    const submittedSource =
      source.type === 'git' && source.repository === 'loaded'
        ? { ...source, repository: root }
        : source;
    const res = await postJson('/api/review', { ...previous, source: submittedSource });
    expect(res.status).toBe(422);
    expect(await res.json()).toMatchObject({ ok: false, code: 'validation-failed' });
    expect(session.reviewState).toBe(previous);
    expect(publisher).not.toHaveBeenCalled();
    expect(fs.readFileSync(outputPath, 'utf8')).toBe('previous document');
    expect(fs.readdirSync(path.join(root, '.self-review-assets'))).toEqual(assets);
    expect((await apiFetch(`${base}/api/diff`)).status).toBe(200);
    const repair = await postJson('/api/review', {
      ...previous,
      source: { repository: root, extension: { preserved: true }, gitDiffArgs: '', type: 'git' },
    });
    expect(repair.status).toBe(200);
    expect(session.reviewState!.source).toMatchObject({ extension: { preserved: true } });
    expect(fs.readFileSync(outputPath, 'utf8')).toContain(root);
  }
);

it.each([
  ['not-authorized', 400],
  ['unsafe-link', 400],
  ['not-regular', 400],
  ['too-large', 413],
  ['io-error', 500],
  ['not-found', 404],
] as const)('retains attachment failure %s as HTTP %s', async (reason, status) => {
  vi.mocked(operations.readAttachment).mockResolvedValue({
    ok: false,
    reason,
    message: `read failed: ${reason}`,
  });
  const res = await apiFetch(`${base}/api/attachment?path=${ATTACH}`);
  expect(res.status).toBe(status);
  expect(res.headers.get('referrer-policy')).toBe('no-referrer');
  expect(await res.json()).toEqual({
    error: reason === 'not-found' ? 'attachment not found' : `read failed: ${reason}`,
  });
});

it('publishes a multi-megabyte valid upload without changing attachment bytes or provenance', async () => {
  const data = Buffer.alloc(2 * 1024 * 1024, 0x67);
  const body = 'Feedback é '.repeat(48 * 1024);
  const res = await postJson('/api/review', {
    timestamp: '2026-01-01T00:00:00Z',
    source: session.diffData!.source,
    files: [
      {
        path: 'src/index.ts',
        changeType: 'added',
        viewed: true,
        comments: [
          {
            id: 'large-upload',
            filePath: 'src/index.ts',
            lineRange: null,
            suggestion: null,
            body,
            category: 'note',
            attachments: [
              {
                id: 'large',
                fileName: 'large.png',
                mediaType: 'image/png',
                dataBase64: data.toString('base64'),
              },
            ],
          },
        ],
      },
    ],
  });
  expect(res.status).toBe(200);
  const document = core.parseReviewXml(path.join(root, 'review.xml'));
  expect(document.comments[0].body).toBe(body);
  const reference = document.comments[0].attachments![0].fileName;
  expect(fs.readFileSync(path.join(root, reference)).equals(data)).toBe(true);
});
