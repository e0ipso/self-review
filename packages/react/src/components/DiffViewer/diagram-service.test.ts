import { describe, expect, it, vi } from 'vitest';
import { createDiagramRenderService } from './diagram-service';

describe('diagram service ownership', () => {
  it('keeps the active slot after abort until actual layout settles', async () => {
    let finish!: (value: { svg: string }) => void;
    const layout = vi
      .fn()
      .mockImplementationOnce(
        () =>
          new Promise<{ svg: string }>(resolve => {
            finish = resolve;
          })
      )
      .mockResolvedValue({ svg: '<svg />' });
    const service = createDiagramRenderService(layout);
    const abort = new AbortController();
    const request = {
      source: 'flowchart LR\n A --> B',
      theme: 'light' as const,
      signal: abort.signal,
    };
    const first = service.render(request);
    await Promise.resolve();
    abort.abort();
    const queued = Array.from({ length: 7 }, () => service.render(request));
    // Already aborted requests never enter the queue.
    await Promise.all(queued.map(result => expect(result).rejects.toBeDefined()));
    const live = { ...request, signal: new AbortController().signal };
    const waiting = Array.from({ length: 7 }, () => service.render(live));
    await expect(service.render(live)).rejects.toMatchObject({ kind: 'busy' });
    expect(layout).toHaveBeenCalledOnce();
    finish({ svg: '<svg />' });
    await first;
    await Promise.all(waiting);
    expect(layout).toHaveBeenCalledTimes(8);
  });

  it('refuses complex input before a supplied layout sees it', async () => {
    const layout = vi.fn();
    const service = createDiagramRenderService(layout);
    await expect(
      service.render({
        source: 'x'.repeat(50001),
        theme: 'dark',
        signal: new AbortController().signal,
      })
    ).rejects.toMatchObject({ kind: 'source' });
    expect(layout).not.toHaveBeenCalled();
  });
});
