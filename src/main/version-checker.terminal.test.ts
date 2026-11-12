import { EventEmitter } from 'node:events';
import { expect, it, vi } from 'vitest';
const state = vi.hoisted(() => ({ request: vi.fn() }));
vi.mock('electron', () => ({ net: { request: state.request } }));
import { checkForUpdate } from './version-checker';
import { UpdateService } from './update-service';

function fixture() {
  const request = Object.assign(new EventEmitter(), {
    setHeader: vi.fn(),
    end: vi.fn(),
    abort: vi.fn(),
  });
  const response = Object.assign(new EventEmitter(), { statusCode: 200 });
  state.request.mockReturnValue(request);
  return { request, response };
}

it.each([
  { side: 'request', status: 200 },
  { side: 'response', status: 200 },
  { side: 'response', status: 503 },
])(
  'contains a $side error after status $status but before transaction close',
  async ({ side, status }) => {
    const { request, response } = fixture();
    response.statusCode = status;
    const check = checkForUpdate();
    request.emit('response', response);
    response.emit('data', Buffer.from('{"tag_name":"v99.0.0"}'));
    response.emit('end');
    await check;
    const target = side === 'request' ? request : response;
    expect(() => target.emit('error', new Error('late network failure'))).not.toThrow();
    request.emit('close');
  }
);

it('contains paired request/response errors before the transaction closes', async () => {
  const { request, response } = fixture();
  const check = checkForUpdate();
  request.emit('response', response);
  request.emit('error', new Error('connection failed'));
  await check;
  expect(() => response.emit('error', new Error('stream failed'))).not.toThrow();
  request.emit('close');
});

it('settles premature transaction close and releases all response listeners and timers', async () => {
  vi.useFakeTimers();
  try {
    const { request, response } = fixture();
    const service = new UpdateService('2.0.4', () => request);
    const check = service.checkForUpdate();
    request.emit('response', response);
    response.emit('data', Buffer.from('{"tag_name":'));
    request.emit('close');
    expect(vi.getTimerCount()).toBe(0);
    await check;
    expect(service.getVersionUpdate()).toBeNull();
    expect(request.eventNames()).toEqual([]);
    expect(response.eventNames()).toEqual([]);
    expect(vi.getTimerCount()).toBe(0);
  } finally {
    vi.useRealTimers();
  }
});
