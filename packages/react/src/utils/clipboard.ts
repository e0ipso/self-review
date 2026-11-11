import type { ReviewAdapter } from '../adapter';

/** Consumers can supply a native clipboard; the browser default reports unavailable access. */
export async function writeClipboard(text: string, adapter: ReviewAdapter | null) {
  if (adapter?.writeClipboard) return adapter.writeClipboard(text);
  if (typeof navigator === 'undefined' || !navigator.clipboard?.writeText)
    throw new Error('Clipboard unavailable');
  await navigator.clipboard.writeText(text);
}
