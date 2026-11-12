import { EventEmitter } from 'node:events';
import { afterEach, expect, it, vi } from 'vitest';
import { UpdateService } from './update-service';

function edge() {
  const request = Object.assign(new EventEmitter(), {
    setHeader: vi.fn(),
    abort: vi.fn(() => {
      request.emit('abort');
      request.emit('close');
    }),
    end: vi.fn(),
  });
  const response = Object.assign(new EventEmitter(), { statusCode: 200 });
  const send = (body: string) => {
    request.emit('response', response);
    response.emit('data', Buffer.from(body));
    response.emit('end');
    request.emit('close');
  };
  return { request, response, send };
}
const release = JSON.stringify({
  tag_name: 'v3.0.0',
  html_url: 'https://github.com/e0ipso/self-review/releases/tag/v3.0.0',
});
afterEach(() => vi.useRealTimers());

it('isolates explicit versions and caches across two independent services', async () => {
  const first = edge();
  const second = edge();
  const request = vi.fn(() => first.request);
  const a = new UpdateService('2.0.4', request);
  const b = new UpdateService('4.0.0', () => second.request);
  const checks = [a.checkForUpdate(), b.checkForUpdate()];
  first.send(release);
  second.send(release);
  await Promise.all(checks);
  expect(a.getVersionUpdate()?.latestVersion).toBe('3.0.0');
  expect(b.getVersionUpdate()).toBeNull();
  expect(request).toHaveBeenCalledExactlyOnceWith({
    url: 'https://api.github.com/repos/e0ipso/self-review/releases/latest',
    method: 'GET',
  });
  expect(first.request.setHeader.mock.calls).toEqual([
    ['User-Agent', 'self-review/2.0.4'],
    ['Accept', 'application/vnd.github.v3+json'],
  ]);
  expect(first.request.end).toHaveBeenCalledOnce();
  expect(first.request.eventNames()).toEqual([]);
  expect(first.response.eventNames()).toEqual([]);
});

it.each(['abort', 'dispose', 'supersede', 'timeout'] as const)(
  'drops late responses after %s and cleans every listener and timer',
  async mode => {
    vi.useFakeTimers();
    const old = edge();
    const next = edge();
    const request = vi.fn().mockReturnValueOnce(old.request).mockReturnValue(next.request);
    const service = new UpdateService('2.0.4', request);
    const owner = new AbortController();
    const remove = vi.spyOn(owner.signal, 'removeEventListener');
    const check = service.checkForUpdate({ signal: owner.signal });
    old.request.emit('response', old.response);
    // Exercise even an already queued callback after cancellation.
    const lateData = old.response.listeners('data')[0];
    const lateEnd = old.response.listeners('end')[0];
    let second: Promise<void> | undefined;
    if (mode === 'abort') owner.abort();
    if (mode === 'dispose') service.dispose();
    if (mode === 'timeout') await vi.advanceTimersByTimeAsync(5000);
    if (mode === 'supersede') second = service.checkForUpdate();
    await check;
    expect(old.request.abort).toHaveBeenCalledOnce();
    expect(old.request.eventNames()).toEqual([]);
    expect(old.response.eventNames()).toEqual([]);
    expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
    if (second) {
      next.send(release.replaceAll('3.0.0', '4.0.0'));
      await second;
    }
    lateData(Buffer.from(release));
    lateEnd();
    expect(service.getVersionUpdate()?.latestVersion ?? null).toBe(
      mode === 'supersede' ? '4.0.0' : null
    );
    expect(vi.getTimerCount()).toBe(0);
    service.dispose();
    await service.checkForUpdate();
    expect(request).toHaveBeenCalledTimes(mode === 'supersede' ? 2 : 1);
  }
);

it.each([1024 * 1024, 1024 * 1024 + 1])(
  'bounds response bytes at %i before buffering',
  async bytes => {
    vi.useFakeTimers();
    const { request, response } = edge();
    const service = new UpdateService('2.0.4', () => request);
    const check = service.checkForUpdate();
    request.emit('response', response);
    const body = release.padEnd(bytes);
    response.emit('data', Buffer.from(body));
    response.emit('end');
    await check;
    expect(service.getVersionUpdate()?.latestVersion ?? null).toBe(
      bytes === 1024 * 1024 ? '3.0.0' : null
    );
    expect(request.abort).toHaveBeenCalledTimes(bytes === 1024 * 1024 ? 0 : 1);
    expect(vi.getTimerCount()).toBe(0);
  }
);

it.each([
  'null',
  '[]',
  '{}',
  '{',
  '{"tag_name":3}',
  '{"tag_name":"3.invalid.0"}',
  '{"tag_name":"v3.0.0","html_url":42}',
])('ignores malformed release metadata %s without cache contamination', async body => {
  const first = edge();
  const second = edge();
  const service = new UpdateService(
    '2.0.4',
    vi.fn().mockReturnValueOnce(first.request).mockReturnValueOnce(second.request)
  );
  const a = service.checkForUpdate();
  first.send(release);
  await a;
  expect(service.getVersionUpdate()).not.toBeNull();
  const b = service.checkForUpdate();
  second.send(body);
  await b;
  expect(service.getVersionUpdate()).toBeNull();
});

it('uses the established release URL fallback and decodes split UTF-8 chunks', async () => {
  const { request, response } = edge();
  const service = new UpdateService('2.0.4', () => request);
  const check = service.checkForUpdate();
  request.emit('response', response);
  const body = Buffer.from('{"tag_name":"v3.0.0","name":"español"}');
  for (const byte of body) response.emit('data', Buffer.from([byte]));
  response.emit('end');
  await check;
  expect(service.getVersionUpdate()).toEqual({
    latestVersion: '3.0.0',
    releaseUrl: 'https://github.com/e0ipso/self-review/releases/tag/v3.0.0',
  });
});

it('skips a cancelled owner and makes synchronous network failures nonfatal', async () => {
  vi.useFakeTimers();
  const request = vi.fn(() => {
    throw new Error('network unavailable');
  });
  const service = new UpdateService('2.0.4', request);
  const owner = new AbortController();
  owner.abort();
  await service.checkForUpdate({ signal: owner.signal });
  expect(request).not.toHaveBeenCalled();
  await expect(service.checkForUpdate()).resolves.toBeUndefined();
  expect(vi.getTimerCount()).toBe(0);
});

it.each(['request', 'response', 'status', 'header', 'end'] as const)(
  'settles nonfatally and cleans up on %s failure',
  async failure => {
    vi.useFakeTimers();
    const { request, response } = edge();
    if (failure === 'header')
      request.setHeader.mockImplementation(() => {
        throw new Error('header');
      });
    if (failure === 'end')
      request.end.mockImplementation(() => {
        throw new Error('end');
      });
    const service = new UpdateService('2.0.4', () => request);
    const check = service.checkForUpdate();
    if (failure === 'request') request.emit('error', new Error('offline'));
    if (failure === 'status') response.statusCode = 503;
    if (failure === 'response' || failure === 'status') request.emit('response', response);
    if (failure === 'response') response.emit('error', new Error('read'));
    request.emit('close');
    await check;
    expect(service.getVersionUpdate()).toBeNull();
    expect(request.eventNames()).toEqual([]);
    expect(response.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  }
);

it.each(['v3', 'v3.0', 'v3.0.0', 'v3.0.0-beta', 'v3.0.0+build'])(
  'preserves previously accepted numeric release tag %s',
  async tag_name => {
    const { request, send } = edge();
    const service = new UpdateService('2.0.4', () => request);
    const check = service.checkForUpdate();
    send(JSON.stringify({ tag_name }));
    await check;
    expect(service.getVersionUpdate()?.latestVersion).toBe(tag_name.slice(1));
  }
);
