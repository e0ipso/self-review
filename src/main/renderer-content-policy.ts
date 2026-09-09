import { shell, type WebContents } from 'electron';

/** Only the development server may receive automatic renderer requests. */
export function isAllowedRendererRequest(url: string, entryUrl: string): boolean {
  try {
    if (url === 'about:blank') return true;
    const resource = new URL(url);
    if (['file:', 'data:', 'blob:'].includes(resource.protocol)) return true;
    const entry = new URL(entryUrl);
    if (entry.protocol !== 'http:' || !['localhost', '127.0.0.1', '[::1]'].includes(entry.hostname)) return false;
    return resource.origin === entry.origin ||
      (resource.protocol === 'ws:' && resource.host === entry.host);
  } catch {
    return false;
  }
}

function openReviewedLink(url: string): void {
  try {
    if (!['https:', 'http:', 'mailto:'].includes(new URL(url).protocol)) return;
    void shell.openExternal(url).catch(error => console.error('[main] Could not open link:', error));
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
