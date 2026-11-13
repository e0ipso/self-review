import * as http from 'node:http';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import * as core from '@self-review/core';
import { readJsonBody } from './http-transport';
import { createPublicationOperations } from './review-operations';
import { createBoundReviewServer, listenLoopback } from './bound-server';
import { REQUEST_SHUTDOWN, type ManagedReviewServer } from './request-admission';

const servers: http.Server[] = [];
const roots: string[] = [];
afterEach(async () => {
  for (const server of servers.splice(0)) {
    const drain = (server as Partial<ManagedReviewServer>)[REQUEST_SHUTDOWN]?.();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
    await drain;
  }
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

const headers = { authorization: 'Bearer key', 'content-type': 'application/json' };
function post(
  url: string,
  chunks: readonly Buffer[],
  extraHeaders: http.OutgoingHttpHeaders = headers
) {
  return new Promise<{ status: number; value: unknown }>((resolve, reject) => {
    const request = http.request(url, { method: 'POST', headers: extraHeaders }, response => {
      const body: Buffer[] = [];
      response.on('data', chunk => body.push(chunk));
      response.on('end', () =>
        resolve({
          status: response.statusCode!,
          value: JSON.parse(Buffer.concat(body).toString('utf8')),
        })
      );
    });
    request.on('error', reject);
    const write = (index: number) => {
      if (index === chunks.length) request.end();
      else request.write(chunks[index], () => setImmediate(() => write(index + 1)));
    };
    write(0);
  });
}
async function listen(server: http.Server) {
  servers.push(server);
  return (await listenLoopback(server)).url;
}
async function transport(maxBytes = 1024, signal?: AbortSignal) {
  let request: http.IncomingMessage | undefined;
  const bodyListeners: Array<{
    event: string;
    listener: ReturnType<http.IncomingMessage['listeners']>[number];
  }> = [];
  const url = await listen(
    http.createServer((req, res) => {
      request = req;
      const events = ['data', 'end', 'error', 'aborted'];
      const before = events.map(event => req.listeners(event));
      const reading = readJsonBody(req, maxBytes, signal);
      events.forEach((event, index) => {
        for (const listener of req.listeners(event)) {
          if (!before[index].includes(listener)) bodyListeners.push({ event, listener });
        }
      });
      void reading.then(result => {
        res.writeHead(result.ok ? 200 : result.status, { 'content-type': 'application/json' });
        res.end(JSON.stringify(result.ok ? result.value : { error: result.error }));
      });
    })
  );
  return { url, request: () => request!, bodyListeners };
}

const malformed = [
  ['isolated continuation', [0x80]],
  ['truncated sequence', [0xe2, 0x82]],
  ['overlong sequence', [0xc0, 0xaf]],
  ['overlong three-byte sequence', [0xe0, 0x80, 0xaf]],
  ['surrogate', [0xed, 0xa0, 0x80]],
  ['out-of-range code point', [0xf4, 0x90, 0x80, 0x80]],
  ['invalid leading byte', [0xff]],
] as const;

describe('UTF-8 mutation admission over loopback', () => {
  it.each(
    malformed.flatMap(([name, bytes]) =>
      (['review', 'apply-suggestion'] as const).map(route => ({ name, bytes, route }))
    )
  )('refuses $name in $route without effects', async ({ bytes, route }) => {
    const root = mkdtempSync(join(tmpdir(), 'serve-json-encoding-'));
    roots.push(root);
    const target = join(root, 'a.txt');
    const output = { path: join(root, 'review.xml'), origin: 'explicit' as const };
    writeFileSync(target, 'before\n');
    writeFileSync(output.path, 'previous XML');
    const source = { type: 'directory' as const, sourcePath: root };
    const session = core.createReviewSession();
    core.commitDiffData(
      session,
      {
        source,
        files: [
          { oldPath: 'a.txt', newPath: 'a.txt', changeType: 'added', isBinary: false, hunks: [] },
        ],
      },
      core.resolveLocalSourceIdentity(source)
    );
    const operations = createPublicationOperations(session, output);
    const publish = vi.spyOn(operations, 'publishReview');
    const apply = vi.spyOn(operations, 'applySuggestionForSession');
    const url = await listen(
      createBoundReviewServer({ capability: 'key', operations, publication: operations })
    );
    const state = {
      timestamp: '2026-01-01T00:00:00Z',
      source,
      files: [
        {
          path: 'a.txt',
          changeType: 'added',
          viewed: false,
          comments: [
            {
              id: 'c',
              filePath: 'a.txt',
              body: 'PLACEHOLDER',
              category: 'bug',
              lineRange: null,
              suggestion: null,
            },
          ],
        },
      ],
    };
    const suggestion = {
      filePath: 'a.txt',
      lineRange: { side: 'new', start: 1, end: 1 },
      suggestion: { originalCode: 'before', proposedCode: 'PLACEHOLDER' },
    };
    const value = route === 'review' ? state : suggestion;
    const [before, after] = JSON.stringify(value).split('PLACEHOLDER');
    const result = await post(url + 'api/' + route, [
      Buffer.from(before),
      Buffer.from(bytes),
      Buffer.from(after),
    ]);
    expect(result).toEqual({ status: 400, value: { error: 'body must be valid JSON' } });
    expect(publish).not.toHaveBeenCalled();
    expect(apply).not.toHaveBeenCalled();
    expect(session.reviewState).toBeNull();
    expect(readFileSync(target, 'utf8')).toBe('before\n');
    expect(readFileSync(output.path, 'utf8')).toBe('previous XML');
    expect(readdirSync(root).sort()).toEqual(['a.txt', 'review.xml']);
  });
});

it('accepts encoded replacement characters and multibyte characters split across chunks', async () => {
  const { url, request } = await transport();
  const value = { body: 'a\uFFFD café 雪 😀\r\n', proposedCode: '\uFEFFinside' };
  const body = Buffer.from(JSON.stringify(value));
  expect(
    await post(
      url,
      [...body].map(byte => Buffer.from([byte]))
    )
  ).toEqual({ status: 200, value });
  for (const event of ['data', 'end', 'error', 'aborted'])
    expect(request().listenerCount(event)).toBe(0);
});

it('retains the leading BOM refusal', async () => {
  const { url } = await transport();
  expect(await post(url, [Buffer.from([0xef, 0xbb, 0xbf]), Buffer.from('{"body":"ok"}')])).toEqual({
    status: 400,
    value: { error: 'body must be valid JSON' },
  });
});

it.each(['declared', 'chunked'] as const)(
  'retains %s byte caps before decoding invalid UTF-8',
  async mode => {
    const { url } = await transport(4);
    const body = Buffer.from([0x22, 0xff, 0xff, 0xff, 0x22]);
    const result = await post(
      url,
      [body],
      mode === 'declared' ? { ...headers, 'content-length': String(body.length) } : headers
    );
    expect(result).toEqual({ status: 413, value: { error: 'request body too large' } });
  }
);

it('retains media type refusal', async () => {
  const { url } = await transport();
  expect(
    await post(url, [Buffer.from('{}')], { ...headers, 'content-type': 'text/plain' })
  ).toEqual({ status: 415, value: { error: 'content-type must be application/json' } });
});

it('cancels a partial multibyte body and removes body listeners', async () => {
  const controller = new AbortController();
  const { url, request: admitted, bodyListeners } = await transport(1024, controller.signal);
  let responseDone!: (value: unknown) => void;
  const result = new Promise<unknown>(resolve => {
    responseDone = resolve;
  });
  const request = http.request(url, { method: 'POST', headers }, response => {
    const chunks: Buffer[] = [];
    response.on('data', chunk => chunks.push(chunk));
    response.on('end', () =>
      responseDone({
        status: response.statusCode,
        value: JSON.parse(Buffer.concat(chunks).toString()),
      })
    );
  });
  request.on('error', () => {});
  try {
    request.write(Buffer.from([0x22, 0xe2]));
    while (!admitted()) await new Promise<void>(resolve => setImmediate(resolve));
    controller.abort();
    expect(await result).toEqual({
      status: 400,
      value: { error: 'request body could not be read' },
    });
    expect(bodyListeners).toHaveLength(4);
    for (const { event, listener } of bodyListeners)
      expect(admitted().listeners(event)).not.toContain(listener);
  } finally {
    request.destroy();
  }
});
