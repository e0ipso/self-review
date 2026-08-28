import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { createReviewSession, type ReviewSession } from '../review-handlers';
import type { AppConfig, ReviewState } from '../../shared/types';
import { createServeServer, listen, stopServer } from './server';

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

function makeState(): ReviewState {
  return {
    timestamp: '2026-08-28T00:00:00.000Z',
    source: { type: 'git', gitDiffArgs: '', repository: '/tmp' },
    files: [],
  };
}

describe('serve server', () => {
  let tmp: string;
  let clientDir: string;
  let outputPath: string;
  let session: ReviewSession;
  let server: Server | null = null;
  let base = '';
  let completed = 0;

  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'serve-test-'));
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
});
