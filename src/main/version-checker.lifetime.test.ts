import { EventEmitter } from 'events';
import { afterEach, expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('electron', () => ({ net: { request: state.request } }));
import { checkForUpdate } from './version-checker';
function fixture() {
  const request = Object.assign(new EventEmitter(), {
    setHeader: vi.fn(),
    abort: vi.fn(),
    end: vi.fn(),
  });
  const response = Object.assign(new EventEmitter(), { statusCode: 200 });
  state.request.mockReturnValue(request);
  return { request, response };
}
afterEach(() => vi.useRealTimers());
it('aborts the optional update request with its owner, and settles without waiting for a response', async () => {
  const { request, response } = fixture();
  const owner = new AbortController();
  const checking = checkForUpdate({ signal: owner.signal });
  request.emit('response', response);
  owner.abort(new Error('shutdown'));
  await checking;
  expect(request.abort).toHaveBeenCalledOnce();
  response.emit('data', Buffer.from('late'));
  response.emit('end');
  expect(request.abort).toHaveBeenCalledOnce();
});
it('bounds response bytes and stops accumulating before the oversized chunk is appended', async () => {
  const { request, response } = fixture();
  const checking = checkForUpdate();
  request.emit('response', response);
  response.emit('data', Buffer.alloc(1024 * 1024 + 1));
  await checking;
  expect(request.abort).toHaveBeenCalledOnce();
});
it('retains the five-second deadline and skips already cancelled startup checks', async () => {
  vi.useFakeTimers();
  const { request } = fixture();
  const checking = checkForUpdate();
  await vi.advanceTimersByTimeAsync(5000);
  await checking;
  expect(request.abort).toHaveBeenCalledOnce();
  const owner = new AbortController();
  owner.abort();
  await checkForUpdate({ signal: owner.signal });
  expect(state.request).toHaveBeenCalledOnce();
});
