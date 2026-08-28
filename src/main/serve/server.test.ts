import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createReviewSession, type ReviewSession } from '../review-handlers';
import type {
  AppConfig,
  DiffFile,
  DiffHunk,
  GuideLoadPayload,
  ReviewComment,
  ReviewState,
} from '../../shared/types';
import { createServeServer, listen, stopServer } from './server';

vi.mock('../git', () => ({
  runGitDiffAsync: vi.fn(),
  readGitBlobAsync: vi.fn(),
}));

function makeConfig(): AppConfig {
  return {
    theme: 'system',
    diffView: 'split',
    fontSize: 14,
    outputFormat: 'xml',
    outputFile: './review.xml',
    ignore: [],
    categories: [],
    defaultDiffArgs: '',
    showUntracked: true,
    showUntrackedExplicit: false,
    wordWrap: true,
    maxFiles: 500,
    maxTotalLines: 100000,
  } as AppConfig;
}

function makeHunk(): DiffHunk {
  return {
    header: '@@ -0,0 +1,1 @@',
    oldStart: 0,
    oldLines: 0,
    newStart: 1,
    newLines: 1,
    lines: [{ type: 'addition', oldLineNumber: null, newLineNumber: 1, content: '+hello' }],
  };
}

function makeFile(newPath: string): DiffFile {
  return {
    oldPath: newPath,
    newPath,
    changeType: 'modified',
    isBinary: false,
    hunks: [makeHunk()],
  };
}

function makeState(): ReviewState {
  return {
    timestamp: '2026-08-28T00:00:00.000Z',
    source: { type: 'git', gitDiffArgs: '', repository: '/tmp' },
    files: [],
  };
}

describe('serve server', () => {
  let tmp: string;
  let repoDir: string;
  let clientDir: string;
  let outputPath: string;
  let session: ReviewSession;
  let server: Server | null = null;
  let base = '';
  let completed = 0;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-test-'));
    repoDir = path.join(tmp, 'repo');
    fs.mkdirSync(repoDir, { recursive: true });
    clientDir = path.join(tmp, 'client');
    outputPath = path.join(tmp, 'review.xml');
    session = createReviewSession();
    session.config = makeConfig();
    session.outputPathInfo = { resolvedOutputPath: outputPath, outputPathWritable: true };
    completed = 0;
  });

  afterEach(async () => {
    if (server) {
      await stopServer(server);
      server = null;
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  async function start(
    overrides: Partial<Parameters<typeof createServeServer>[0]> = {}
  ): Promise<void> {
    server = createServeServer({
      session,
      outputPath,
      clientDir,
      onReviewComplete: () => {
        completed++;
      },
      ...overrides,
    });
    const address = (await listen(server, '127.0.0.1', 0)) as AddressInfo;
    base = `http://127.0.0.1:${address.port}`;
  }

  function writeClient(): void {
    fs.mkdirSync(path.join(clientDir, 'assets'), { recursive: true });
    fs.writeFileSync(path.join(clientDir, 'index.html'), '<!doctype html>CLIENT');
    fs.writeFileSync(path.join(clientDir, 'assets', 'app.js'), 'console.log(1);');
  }

  describe('GET /api/config', () => {
    it('returns the resolved config, the output path, and the read-only marker', async () => {
      await start();
      const res = await fetch(`${base}/api/config`);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const body = await res.json();
      expect(body.config.outputFormat).toBe('xml');
      expect(body.outputPathInfo).toEqual({
        resolvedOutputPath: outputPath,
        outputPathWritable: true,
      });
      expect(body.outputPathReadOnly).toBe(true);
    });

    it('rejects a non-GET method', async () => {
      await start();
      const res = await fetch(`${base}/api/config`, { method: 'POST' });
      expect(res.status).toBe(405);
    });
  });

  describe('POST /api/review', () => {
    it('writes the XML, responds, and only then ends the session', async () => {
      await start();

      const res = await fetch(`${base}/api/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(makeState()),
      });
      const body = await res.json();

      expect(res.status).toBe(200);
      expect(body.ok).toBe(true);
      expect(body.outputPath).toBe(outputPath);
      expect(fs.existsSync(outputPath)).toBe(true);
      expect(fs.readFileSync(outputPath, 'utf-8')).toContain('<review');
      expect(session.reviewState).not.toBeNull();
      // The response is fully read above; the session end follows it.
      await vi.waitFor(() => expect(completed).toBe(1));
    }, 30000);

    it('writes nothing to the output path until a review is submitted', async () => {
      await start();
      await fetch(`${base}/api/config`);
      await fetch(`${base}/`);
      expect(fs.existsSync(outputPath)).toBe(false);
    });

    it('rejects a malformed body without ending the session', async () => {
      await start();
      const res = await fetch(`${base}/api/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: 'not json',
      });
      expect(res.status).toBe(400);
      expect(fs.existsSync(outputPath)).toBe(false);
      expect(completed).toBe(0);
    });

    it('keeps serving when the write fails, so the reviewer can retry', async () => {
      await start({
        writeReview: async () => {
          throw new Error('disk on fire');
        },
      });
      const res = await fetch(`${base}/api/review`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(makeState()),
      });
      expect(res.status).toBe(500);
      expect(await res.text()).toContain('disk on fire');
      expect(completed).toBe(0);

      // Still listening.
      expect((await fetch(`${base}/api/config`)).status).toBe(200);
    });
  });

  describe('unknown API routes', () => {
    it('404s rather than falling back to the client document', async () => {
      writeClient();
      await start();
      const res = await fetch(`${base}/api/nope`);
      expect(res.status).toBe(404);
      expect(res.headers.get('content-type')).toContain('application/json');
    });
  });

  describe('static assets', () => {
    it('serves the entry document at the root', async () => {
      writeClient();
      await start();
      const res = await fetch(`${base}/`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('text/html');
      expect(await res.text()).toContain('CLIENT');
    });

    it('serves a built asset with its content type', async () => {
      writeClient();
      await start();
      const res = await fetch(`${base}/assets/app.js`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('javascript');
    });

    it('falls back to the entry document for an unknown path', async () => {
      writeClient();
      await start();
      const res = await fetch(`${base}/some/client/route`);
      expect(res.status).toBe(200);
      expect(await res.text()).toContain('CLIENT');
    });

    it('refuses to escape the client directory', async () => {
      writeClient();
      await start();
      const res = await fetch(`${base}/%2e%2e%2f%2e%2e%2fpackage.json`);
      expect(res.status).toBe(404);
    });

    it('explains itself when the client bundle has not been built', async () => {
      await start();
      const res = await fetch(`${base}/`);
      expect(res.status).toBe(503);
      const text = await res.text();
      expect(text).toContain(clientDir);
    });

    it('keeps the API working when the client bundle is missing', async () => {
      await start();
      expect((await fetch(`${base}/api/config`)).status).toBe(200);
    });
  });

  // ===== Data routes =====

  /** 1x1 transparent PNG. Small, real, and byte-comparable. */
  const PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
    'base64'
  );

  function gitSession(files: DiffFile[]): void {
    session.diffData = {
      files,
      source: { type: 'git', gitDiffArgs: '', repository: repoDir },
    };
  }

  describe('GET /api/diff', () => {
    it('returns the diff and the guide in a single response body', async () => {
      gitSession([makeFile('src/app.ts')]);
      const guide: GuideLoadPayload = { overview: 'read this', groups: [] };
      session.guideData = guide;
      await start();

      const res = await fetch(`${base}/api/diff`);

      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toContain('application/json');
      const body = await res.json();
      // `files` is top level: the body is the diff payload, plus the guide.
      expect(body.files).toHaveLength(1);
      expect(body.files[0].newPath).toBe('src/app.ts');
      expect(body.source.repository).toBe(repoDir);
      expect(body.guide).toEqual(guide);
    });

    it('carries a null guide rather than omitting the field', async () => {
      gitSession([makeFile('src/app.ts')]);
      await start();

      const body = await (await fetch(`${base}/api/diff`)).json();
      expect(body).toHaveProperty('guide', null);
    });

    it('marks every file loaded in normal mode', async () => {
      gitSession([makeFile('src/app.ts')]);
      await start();

      const body = await (await fetch(`${base}/api/diff`)).json();
      expect(body.files[0].contentLoaded).toBe(true);
      expect(body.files[0].hunks).toHaveLength(1);
    });

    it('strips hunks in large-payload mode, leaving them to /api/file', async () => {
      gitSession([makeFile('src/app.ts')]);
      session.diffData!.isLargePayload = true;
      await start();

      const body = await (await fetch(`${base}/api/diff`)).json();
      expect(body.isLargePayload).toBe(true);
      expect(body.files[0].hunks).toEqual([]);
      expect(body.files[0].contentLoaded).toBe(false);

      const hunks = await (await fetch(`${base}/api/file/src/app.ts`)).json();
      expect(hunks).toHaveLength(1);
      expect(hunks[0].lines[0].content).toBe('+hello');
    });

    it('reports a session that never resolved a diff', async () => {
      await start();
      const res = await fetch(`${base}/api/diff`);
      expect(res.status).toBe(500);
    });

    it('rejects a non-GET method', async () => {
      gitSession([makeFile('src/app.ts')]);
      await start();
      expect((await fetch(`${base}/api/diff`, { method: 'POST' })).status).toBe(405);
    });
  });

  describe('GET /api/resume', () => {
    it('returns the restored comments and viewed files', async () => {
      const comment = { id: 'c1', filePath: 'src/app.ts', body: 'hi' } as unknown as ReviewComment;
      session.resumeComments = [comment];
      session.resumeViewedFiles = ['src/app.ts'];
      await start();

      const res = await fetch(`${base}/api/resume`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.comments).toHaveLength(1);
      expect(body.viewedFiles).toEqual(['src/app.ts']);
    });

    it('returns null when there is nothing to resume', async () => {
      await start();
      const res = await fetch(`${base}/api/resume`);
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });
  });

  describe('POST /api/expand-context', () => {
    it('forwards the request to the shared handler and returns its hunks', async () => {
      const { runGitDiffAsync } = await import('../git');
      vi.mocked(runGitDiffAsync).mockResolvedValue(
        [
          'diff --git a/src/app.ts b/src/app.ts',
          'index 0000000..1111111 100644',
          '--- a/src/app.ts',
          '+++ b/src/app.ts',
          '@@ -0,0 +1,1 @@',
          '+ hello',
          '',
        ].join('\n')
      );
      gitSession([makeFile('src/app.ts')]);
      await start();

      const res = await fetch(`${base}/api/expand-context`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filePath: 'src/app.ts', contextLines: 20 }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.hunks).toHaveLength(1);
      expect(vi.mocked(runGitDiffAsync)).toHaveBeenCalledWith(
        ['-U20', '--', 'src/app.ts'],
        repoDir
      );
      // The expansion persists on the session, as it does on the desktop.
      expect(session.diffData!.files[0].hunks).toHaveLength(1);
    });

    it('returns null when the handler cannot expand', async () => {
      session.diffData = {
        files: [makeFile('app.ts')],
        source: { type: 'directory', sourcePath: repoDir },
      };
      await start();

      const res = await fetch(`${base}/api/expand-context`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filePath: 'app.ts', contextLines: 20 }),
      });
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });

    it('rejects a body that is not an expand-context request', async () => {
      gitSession([makeFile('src/app.ts')]);
      await start();
      const res = await fetch(`${base}/api/expand-context`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filePath: 'src/app.ts' }),
      });
      expect(res.status).toBe(400);
    });

    it('refuses a file path that escapes the review root', async () => {
      gitSession([makeFile('src/app.ts')]);
      await start();
      const res = await fetch(`${base}/api/expand-context`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ filePath: '../../etc/passwd', contextLines: 20 }),
      });
      expect(res.status).toBe(400);
    });

    it('rejects a non-POST method', async () => {
      await start();
      expect((await fetch(`${base}/api/expand-context`)).status).toBe(405);
    });
  });

  describe('GET /api/file/:path', () => {
    it('returns the hunks for a nested path', async () => {
      gitSession([makeFile('src/deeply/nested/app.ts')]);
      await start();

      const res = await fetch(`${base}/api/file/src/deeply/nested/app.ts`);
      expect(res.status).toBe(200);
      expect(await res.json()).toHaveLength(1);
    });

    it('decodes an encoded path', async () => {
      gitSession([makeFile('src/a b.ts')]);
      await start();

      const res = await fetch(`${base}/api/file/src/a%20b.ts`);
      expect(res.status).toBe(200);
      expect(await res.json()).toHaveLength(1);
    });

    it('returns null for a path the diff does not carry', async () => {
      gitSession([makeFile('src/app.ts')]);
      await start();

      const res = await fetch(`${base}/api/file/src/other.ts`);
      expect(res.status).toBe(200);
      expect(await res.json()).toBeNull();
    });

    it('requires a path', async () => {
      gitSession([makeFile('src/app.ts')]);
      await start();
      expect((await fetch(`${base}/api/file/`)).status).toBe(400);
    });
  });

  describe('GET /api/image/:path', () => {
    it('returns a data URI for an image in the review root', async () => {
      fs.mkdirSync(path.join(repoDir, 'assets'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'assets', 'pic.png'), PNG);
      gitSession([makeFile('assets/pic.png')]);
      await start();

      const res = await fetch(`${base}/api/image/assets/pic.png`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.dataUri).toBe(`data:image/png;base64,${PNG.toString('base64')}`);
    });

    it('reports a missing image as an error result rather than a failed request', async () => {
      gitSession([makeFile('assets/gone.png')]);
      await start();

      const res = await fetch(`${base}/api/image/assets/gone.png`);
      expect(res.status).toBe(200);
      expect((await res.json()).error).toContain('not found');
    });

    it('refuses a path that escapes the review root', async () => {
      gitSession([makeFile('assets/pic.png')]);
      await start();

      const res = await fetch(`${base}/api/image/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd`);
      expect(res.status).toBe(400);
      expect((await res.json()).error).toBeTruthy();
    });
  });

  describe('GET /api/attachment/:path', () => {
    it('returns the raw bytes, byte-identical to the file on disk', async () => {
      const assetDir = path.join(tmp, '.self-review-assets');
      fs.mkdirSync(assetDir, { recursive: true });
      const onDisk = path.join(assetDir, 'c1-0.png');
      fs.writeFileSync(onDisk, PNG);
      gitSession([makeFile('src/app.ts')]);
      await start();

      const res = await fetch(`${base}/api/attachment/.self-review-assets/c1-0.png`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('image/png');
      const bytes = Buffer.from(await res.arrayBuffer());
      expect(bytes.equals(fs.readFileSync(onDisk))).toBe(true);
    });

    it('serves a byte-exact payload larger than one read buffer', async () => {
      const assetDir = path.join(tmp, '.self-review-assets');
      fs.mkdirSync(assetDir, { recursive: true });
      const onDisk = path.join(assetDir, 'big.bin');
      const big = Buffer.alloc(1024 * 1024);
      for (let i = 0; i < big.length; i++) big[i] = i % 256;
      fs.writeFileSync(onDisk, big);
      gitSession([makeFile('src/app.ts')]);
      await start();

      const res = await fetch(`${base}/api/attachment/.self-review-assets/big.bin`);
      expect(res.status).toBe(200);
      expect(res.headers.get('content-type')).toBe('application/octet-stream');
      expect(Number(res.headers.get('content-length'))).toBe(big.length);
      const bytes = Buffer.from(await res.arrayBuffer());
      expect(bytes.equals(big)).toBe(true);
    });

    it('resolves a path inside the diff repository too', async () => {
      fs.mkdirSync(path.join(repoDir, 'docs'), { recursive: true });
      fs.writeFileSync(path.join(repoDir, 'docs', 'shot.png'), PNG);
      gitSession([makeFile('src/app.ts')]);
      await start();

      const res = await fetch(`${base}/api/attachment/docs/shot.png`);
      expect(res.status).toBe(200);
      expect(Buffer.from(await res.arrayBuffer()).equals(PNG)).toBe(true);
    });

    it('404s for an attachment that is not on disk', async () => {
      gitSession([makeFile('src/app.ts')]);
      await start();
      expect((await fetch(`${base}/api/attachment/.self-review-assets/gone.png`)).status).toBe(404);
    });

    it('refuses a path that escapes both roots', async () => {
      gitSession([makeFile('src/app.ts')]);
      await start();
      const res = await fetch(`${base}/api/attachment/%2e%2e%2f%2e%2e%2f%2e%2e%2fetc/passwd`);
      expect(res.status).toBe(400);
    });
  });
});
