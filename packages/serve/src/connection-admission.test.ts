import { afterEach, describe, expect, it } from 'vitest';
import { once } from 'node:events';
import * as net from 'node:net';
import * as http from 'node:http';
import { createReviewSession } from '@self-review/core';
import { createReviewServer, listenLoopback } from './server';

const sockets: net.Socket[] = [];
let server: ReturnType<typeof createReviewServer> | undefined;
afterEach(async () => {
  for (const socket of sockets.splice(0)) socket.destroy();
  server?.closeAllConnections();
  if (server) await new Promise<void>(resolve => server!.close(() => resolve()));
  server = undefined;
});
function create(maxConnections?: number) {
  server = createReviewServer({
    session: createReviewSession(),
    output: { path: '/review.xml', origin: 'explicit' },
    capability: 'test-capability',
    maxConnections,
  });
  return server;
}
async function connect(port: number) {
  const socket = net.connect(port, '127.0.0.1');
  sockets.push(socket);
  await once(socket, 'connect');
  return socket;
}
function connections(): Promise<number> {
  return new Promise((resolve, reject) =>
    server!.getConnections((error, count) => {
      if (error) reject(error);
      else resolve(count);
    })
  );
}

describe('connection admission before HTTP headers', () => {
  it('caps idle and incomplete-header sockets and frees capacity after close', async () => {
    const { port } = await listenLoopback(create(2));
    const idle = await connect(port);
    const incomplete = await connect(port);
    incomplete.write('GET /api/diff HTTP/1.1\r\nHost: 127.0.0.1\r\nX-Incomplete: ');
    expect(await connections()).toBe(2);
    const excess = await connect(port);
    let untrustedResponse = '';
    excess.on('data', chunk => {
      untrustedResponse += chunk.toString();
    });
    await once(excess, 'close');
    expect(untrustedResponse).toBe('');
    expect(await connections()).toBe(2);
    const closed = once(incomplete, 'close');
    incomplete.destroy();
    await closed;
    // The server observes FIN on the next turn; its own close event confirms release.
    idle.end();
    await once(idle, 'close');
    const replacement = await connect(port);
    const response = once(replacement, 'data');
    replacement.write('GET /api/diff HTTP/1.1\r\nHost: 127.0.0.1\r\nConnection: close\r\n\r\n');
    expect((await response)[0].toString()).toContain('401 Unauthorized');
  });

  it('preserves normal HTTP keepalive within the socket cap', async () => {
    const { port } = await listenLoopback(create(1));
    const agent = new http.Agent({ keepAlive: true, maxSockets: 1 });
    const request = () =>
      new Promise<{ status: number; socket: net.Socket }>((resolve, reject) => {
        http
          .get(
            {
              host: '127.0.0.1',
              port,
              path: '/api/diff',
              agent,
              headers: { authorization: 'Bearer test-capability' },
            },
            res => {
              const socket = res.socket;
              res.resume();
              res.once('end', () => resolve({ status: res.statusCode!, socket }));
            }
          )
          .once('error', reject);
      });
    try {
      const first = await request();
      const second = await request();
      expect(first.status).toBe(200);
      expect(second.status).toBe(200);
      expect(second.socket).toBe(first.socket);
      expect(await connections()).toBe(1);
    } finally {
      agent.destroy();
    }
  });

  it.each([0, -1, 1.5, NaN, Infinity])('refuses invalid socket cap %s', value => {
    expect(() => create(value)).toThrow('Connection limit must be a positive safe integer.');
  });
});
