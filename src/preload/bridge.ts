import type { IpcRenderer } from 'electron';
import type { ElectronAPI } from '../shared/types';
import { PRELOAD_BINDINGS } from './bindings';

export function createElectronAPI(
  ipcRenderer: Pick<IpcRenderer, 'on' | 'removeListener' | 'send' | 'invoke'>
): ElectronAPI {
  function subscribe(channel: string, callback: (...args: unknown[]) => void): () => void {
    const handler = (_event: Electron.IpcRendererEvent, ...args: unknown[]) => callback(...args);
    ipcRenderer.on(channel, handler);
    let disposed = false;
    return () => {
      if (disposed) return;
      disposed = true;
      ipcRenderer.removeListener(channel, handler);
    };
  }

  const api: Record<string, unknown> = {};
  for (const [method, [mode, channel]] of Object.entries(PRELOAD_BINDINGS)) {
    switch (mode) {
      case 'invoke':
        api[method] = (...args: unknown[]) => ipcRenderer.invoke(channel, ...args);
        break;
      case 'send':
        api[method] = (...args: unknown[]) => {
          ipcRenderer.send(channel, ...args);
        };
        break;
      case 'subscribe':
        api[method] = (callback: (...args: unknown[]) => void) => subscribe(channel, callback);
        break;
    }
  }
  // Object iteration erases the per-method tuples. The exhaustive catalog checks
  // each transport against ElectronAPI; these wrappers forward its arguments unchanged.
  return api as unknown as ElectronAPI;
}
