import { shell, type WebContents } from 'electron';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Forge emits renderer assets under .webpack, optionally inside an architecture directory. */
function isBundledResource(resource: URL, entry: URL, rawUrl: string): boolean {
  if (entry.protocol !== 'file:' || entry.host || resource.host) return false;
  if (!/\/\.webpack\/(?:[^/]+\/)?renderer\/main_window\/index\.html$/.test(entry.pathname))
    return false;
  // Reject platform-dependent separators before decoding. URL parsing itself normalizes dot
  // segments; the decoded path comparison below still bounds the normalized result.
  if (rawUrl.split(/[?#]/, 1)[0].includes('\\') || /%2f|%5c|%00/i.test(rawUrl.split(/[?#]/, 1)[0]))
    return false;
  const root = fileURLToPath(new URL('../', entry));
  const relative = path.relative(root, fileURLToPath(resource));
  return relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

/** Only trusted bundle files and the development server receive automatic resource requests. */
export function isAllowedRendererRequest(url: string, entryUrl: string): boolean {
  try {
    if (url === 'about:blank') return true;
    const resource = new URL(url);
    if (['data:', 'blob:'].includes(resource.protocol)) return true;
    const entry = new URL(entryUrl);
    if (resource.protocol === 'file:') return isBundledResource(resource, entry, url);
    if (entry.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(entry.hostname))
      return false;
    return (
      resource.origin === entry.origin ||
      (resource.protocol === 'ws:' && resource.host === entry.host)
    );
  } catch {
    return false;
  }
}

function openReviewedLink(url: string): void {
  try {
    if (!['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) return;
    void shell
      .openExternal(url)
      .catch(error => console.error('[main] Could not open link:', error));
  } catch {
    // Invalid links from reviewed text stay inert.
  }
}

export function installRendererContentPolicy(webContents: WebContents, entryUrl: string): void {
  // This session belongs to the UI. The default-session version check and forge subprocesses
  // do not use it, and receive no renderer-wide network exception.
  webContents.session.webRequest.onBeforeRequest((details, callback) => {
    callback({ cancel: !isAllowedRendererRequest(details.url, entryUrl) });
  });
  webContents.on('will-navigate', (event, url) => {
    event.preventDefault();
    openReviewedLink(url);
  });
  webContents.setWindowOpenHandler(({ url }) => {
    // AttachmentImage creates an empty window and fills it with a blob preview.
    if (url === 'about:blank') return { action: 'allow' };
    openReviewedLink(url);
    return { action: 'deny' };
  });
}
