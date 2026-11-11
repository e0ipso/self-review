import { Blob as NodeBlob } from 'node:buffer';
import { it, expect, vi, afterEach } from 'vitest';
import { processImageFile, IMAGE_MAX_PIXELS } from './image-utils';

afterEach(() => vi.unstubAllGlobals());
function png(width: number, height: number) {
  const bytes = new Uint8Array(24);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  const view = new DataView(bytes.buffer);
  view.setUint32(16, width);
  view.setUint32(20, height);
  return new NodeBlob([bytes], { type: 'image/png' }) as unknown as Blob;
}
it('rejects excessive dimensions and unsupported headers before allocating a bitmap', async () => {
  const decode = vi.fn();
  vi.stubGlobal('createImageBitmap', decode);
  await expect(processImageFile(png(8000, 8000))).rejects.toMatchObject({ code: 'dimensions' });
  await expect(
    processImageFile(new NodeBlob(['<svg/>'], { type: 'image/svg+xml' }) as unknown as Blob)
  ).rejects.toMatchObject({ code: 'format' });
  expect(IMAGE_MAX_PIXELS).toBe(16_000_000);
  expect(decode).not.toHaveBeenCalled();
});
it('closes a late bitmap when cancelled during decoding', async () => {
  let finish!: (value: ImageBitmap) => void;
  vi.stubGlobal(
    'createImageBitmap',
    () =>
      new Promise(resolve => {
        finish = resolve;
      })
  );
  const abort = new AbortController();
  const result = processImageFile(png(10, 10), abort.signal);
  await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
  abort.abort();
  const close = vi.fn();
  finish({ width: 10, height: 10, close } as unknown as ImageBitmap);
  await expect(result).rejects.toBeTruthy();
  expect(close).toHaveBeenCalledOnce();
});
