import { describe, expect, it, vi } from 'vitest';
import { shell, type WebContents } from 'electron';
import { isAllowedRendererRequest, installRendererContentPolicy } from './renderer-content-policy';

vi.mock('electron', () => ({ shell: { openExternal: vi.fn(async () => {}) } }));

const entry =
  'file:///opt/Self%20Review/resources/app.asar/.webpack/renderer/main_window/index.html';
const bundle = 'file:///opt/Self%20Review/resources/app.asar/.webpack/renderer/';

describe('automatic renderer resources', () => {
  it.each(['x64', 'arm64'])('retains Forge resources in the %s output directory', arch => {
    const renderer = `file:///opt/Self%20Review/resources/app.asar/.webpack/${arch}/renderer/`;
    const packagedEntry = `${renderer}main_window/index.html`;
    for (const url of [
      packagedEntry,
      `${renderer}main_window/index.js`,
      `${renderer}main_window/index.css?v=1#style`,
      `${renderer}assets/字%20体.woff2`,
      `${renderer}42.chunk.js`,
    ]) {
      expect(isAllowedRendererRequest(url, packagedEntry), url).toBe(true);
    }
    for (const url of [
      'file:///outside-private/not-reviewed.png',
      `${renderer}../main/index.js`,
      `${renderer.slice(0, -1)}-other/private.png`,
      `${renderer}main_window/%2foutside.png`,
      `${renderer}main_window/%5coutside.png`,
      `${renderer}main_window/%00.png`,
      `${bundle}main_window/index.js`,
      'https://outside.test/private.png',
    ]) {
      expect(isAllowedRendererRequest(url, packagedEntry), url).toBe(false);
    }
  });

  it.each([
    'file:///outside-private/not-reviewed.png',
    `${bundle}../main/index.js`,
    `${bundle.slice(0, -1)}-other/private.png`,
    `file://outside-host/opt/Self%20Review/resources/app.asar/.webpack/renderer/private.png`,
    `${bundle}%2e%2e/main/private.png`,
    `${bundle}main_window/%2foutside.png`,
    `${bundle}main_window/%5coutside.png`,
    `${bundle}main_window/..\\..\\private.png`,
    `${bundle}main_window/%00.png`,
    'https://outside.test/private.png',
  ])('refuses automatic resource %s', url => {
    expect(isAllowedRendererRequest(url, entry)).toBe(false);
  });

  it.each([
    entry,
    `${bundle}main_window/index.js`,
    `${bundle}main_window/index.css?v=1#style`,
    `${bundle}main_window/index.js?ref=%2Fpath#%5cfragment`,
    `${bundle}assets/字%20体.woff2`,
    `${bundle}42.chunk.js`,
    `${bundle}main_window/icon.png`,
    'data:image/png;base64,AA==',
    'data:image/svg+xml,%3Csvg/%3E',
    'blob:null/image-preview',
    'about:blank',
  ])('retains bundled or passive resource %s', url => {
    expect(isAllowedRendererRequest(url, entry)).toBe(true);
  });

  it('keeps a development origin and its websocket without permitting file resources', () => {
    for (const host of ['localhost', '127.0.0.1', '[::1]']) {
      const devEntry = `http://${host}:3000/main_window`;
      expect(isAllowedRendererRequest(`http://${host}:3000/index.js`, devEntry)).toBe(true);
      expect(isAllowedRendererRequest(`ws://${host}:3000/socket`, devEntry)).toBe(true);
      expect(isAllowedRendererRequest(`http://${host}:3001/image`, devEntry)).toBe(false);
      expect(isAllowedRendererRequest('file:///outside-private/not-reviewed.png', devEntry)).toBe(
        false
      );
    }
    expect(isAllowedRendererRequest('https://outside.test/a', 'https://outside.test/')).toBe(false);
  });

  it('cancels unreviewed file requests through the installed Electron hook', () => {
    let beforeRequest!: (
      details: { url: string },
      callback: (result: { cancel: boolean }) => void
    ) => void;
    const webContents = {
      session: {
        webRequest: {
          onBeforeRequest: vi.fn(callback => {
            beforeRequest = callback;
          }),
        },
      },
      on: vi.fn(),
      setWindowOpenHandler: vi.fn(),
    } as unknown as WebContents;
    installRendererContentPolicy(webContents, entry);
    const callback = vi.fn();
    beforeRequest({ url: new URL('/outside-private/not-reviewed.png', entry).href }, callback);
    expect(callback).toHaveBeenCalledWith({ cancel: true });
  });
});

it('keeps reviewer-requested external links separate from automatic resources', () => {
  const listeners = new Map<string, (event: { preventDefault: () => void }, url: string) => void>();
  let openWindow!: (details: { url: string }) => { action: string };
  const webContents = {
    session: { webRequest: { onBeforeRequest: vi.fn() } },
    on: vi.fn((name, callback) => listeners.set(name, callback)),
    setWindowOpenHandler: vi.fn(callback => {
      openWindow = callback;
    }),
  } as unknown as WebContents;
  installRendererContentPolicy(webContents, entry);
  const event = { preventDefault: vi.fn() };
  listeners.get('will-navigate')!(event, 'https://example.test/docs');
  expect(event.preventDefault).toHaveBeenCalledOnce();
  expect(shell.openExternal).toHaveBeenCalledWith('https://example.test/docs');
  expect(openWindow({ url: 'mailto:reviewer@example.test' })).toEqual({ action: 'deny' });
  expect(shell.openExternal).toHaveBeenCalledWith('mailto:reviewer@example.test');
  expect(openWindow({ url: 'file:///secret.png' })).toEqual({ action: 'deny' });
  expect(shell.openExternal).not.toHaveBeenCalledWith('file:///secret.png');
  expect(openWindow({ url: 'about:blank' })).toEqual({ action: 'allow' });
});
