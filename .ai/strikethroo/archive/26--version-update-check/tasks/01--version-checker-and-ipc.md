---
id: 1
group: "version-check"
dependencies: []
status: "completed"
created: "2026-02-27"
skills:
  - typescript
  - electron
---
# Implement version checker module, IPC channel, and preload bridge

## Objective
Create the main-process version checker that fetches the latest release from GitHub, the shared types and IPC channel, the preload bridge methods, and the integration call in `main.ts`. This is the entire backend slice of the feature.

## Skills Required
- TypeScript (Electron main process, Node.js networking)
- Electron (IPC, preload bridge, `net` module, `shell.openExternal`)

## Acceptance Criteria
- [ ] New file `src/main/version-checker.ts` exports `checkForUpdate(mainWindow: BrowserWindow): Promise<void>`
- [ ] The function fetches `https://api.github.com/repos/e0ipso/self-review/releases/latest` using Electron's `net` module
- [ ] Compares `tag_name` from the response (stripping leading `v`) against the local version from `package.json`
- [ ] If `latest > current`, sends `VersionUpdateInfo` to the renderer via IPC channel `version-update:available`
- [ ] All errors (network, parse, timeout) are caught and silently ignored — no console output on failure
- [ ] Request has a 5-second timeout
- [ ] `src/shared/ipc-channels.ts` has new `VERSION_UPDATE_AVAILABLE: 'version-update:available'` and `OPEN_EXTERNAL: 'open-external'` entries
- [ ] `src/shared/types.ts` has new `VersionUpdateInfo` interface with `latestVersion: string` and `releaseUrl: string`
- [ ] `ElectronAPI` in `types.ts` is extended with `onVersionUpdate(callback: (info: VersionUpdateInfo) => void): void` and `openExternal(url: string): Promise<void>`
- [ ] `src/preload/preload.ts` exposes `onVersionUpdate` and `openExternal` via contextBridge
- [ ] `src/main/ipc-handlers.ts` registers the `open-external` handler using `shell.openExternal`
- [ ] `src/main/main.ts` calls `checkForUpdate(mainWindow)` after `createWindow()` in `initializeApp()`, fire-and-forget with `.catch(() => {})`

Use your internal Todo tool to track these and keep on track.

## Technical Requirements
- Use Electron's `net.request()` for the HTTP GET (respects system proxy, works in main process)
- Set `User-Agent` header (GitHub API requires it): `self-review/${version}`
- 5-second timeout via `request.abort()` on a `setTimeout`
- Simple semver comparison: split on `.`, compare major/minor/patch as integers. No need for a library.
- `shell.openExternal(url)` for the external link handler — restrict to `https://github.com/` URLs for security

## Input Dependencies
None — this is a foundation task.

## Output Artifacts
- `src/main/version-checker.ts` — version check logic
- Updated `src/shared/ipc-channels.ts` — new channel constants
- Updated `src/shared/types.ts` — `VersionUpdateInfo` type, extended `ElectronAPI`
- Updated `src/preload/preload.ts` — new bridge methods
- Updated `src/main/ipc-handlers.ts` — `open-external` handler
- Updated `src/main/main.ts` — fire-and-forget call to `checkForUpdate`

## Implementation Notes

<details>
<summary>Detailed implementation guidance</summary>

### 1. Add IPC channels (`src/shared/ipc-channels.ts`)

Add two new entries to the `IPC` const:
```
VERSION_UPDATE_AVAILABLE: 'version-update:available',
OPEN_EXTERNAL: 'open-external',
```

### 2. Add types (`src/shared/types.ts`)

Add after the `FindInPageResult` interface:
```typescript
export interface VersionUpdateInfo {
  latestVersion: string;
  releaseUrl: string;
}
```

Extend `ElectronAPI` with:
```typescript
onVersionUpdate: (callback: (info: VersionUpdateInfo) => void) => void;
openExternal: (url: string) => Promise<void>;
```

### 3. Create `src/main/version-checker.ts`

```typescript
import { net, BrowserWindow } from 'electron';
import { IPC } from '../shared/ipc-channels';
import { VersionUpdateInfo } from '../shared/types';

const GITHUB_API_URL = 'https://api.github.com/repos/e0ipso/self-review/releases/latest';
const TIMEOUT_MS = 5000;

function compareVersions(current: string, latest: string): boolean {
  const c = current.split('.').map(Number);
  const l = latest.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((l[i] || 0) > (c[i] || 0)) return true;
    if ((l[i] || 0) < (c[i] || 0)) return false;
  }
  return false;
}

export async function checkForUpdate(mainWindow: BrowserWindow): Promise<void> {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { version: currentVersion } = require('../../package.json');

  return new Promise<void>((resolve) => {
    const request = net.request({
      url: GITHUB_API_URL,
      method: 'GET',
    });

    request.setHeader('User-Agent', `self-review/${currentVersion}`);
    request.setHeader('Accept', 'application/vnd.github.v3+json');

    const timeout = setTimeout(() => {
      request.abort();
      resolve();
    }, TIMEOUT_MS);

    let body = '';

    request.on('response', (response) => {
      if (response.statusCode !== 200) {
        clearTimeout(timeout);
        resolve();
        return;
      }

      response.on('data', (chunk: Buffer) => {
        body += chunk.toString();
      });

      response.on('end', () => {
        clearTimeout(timeout);
        try {
          const data = JSON.parse(body);
          const tagName = data.tag_name;
          if (typeof tagName !== 'string') { resolve(); return; }
          const latestVersion = tagName.replace(/^v/, '');
          if (compareVersions(currentVersion, latestVersion)) {
            const info: VersionUpdateInfo = {
              latestVersion,
              releaseUrl: data.html_url || `https://github.com/e0ipso/self-review/releases/tag/${tagName}`,
            };
            mainWindow.webContents.send(IPC.VERSION_UPDATE_AVAILABLE, info);
          }
        } catch {
          // Silently ignore parse errors
        }
        resolve();
      });

      response.on('error', () => {
        clearTimeout(timeout);
        resolve();
      });
    });

    request.on('error', () => {
      clearTimeout(timeout);
      resolve();
    });

    request.end();
  });
}
```

Key points:
- Uses `net.request()` (Electron's networking, respects proxy).
- Resolves (never rejects) in all code paths.
- `compareVersions` is a simple numeric comparison of major.minor.patch.

### 4. Update preload (`src/preload/preload.ts`)

Add these to the `contextBridge.exposeInMainWorld('electronAPI', { ... })` object:
```typescript
onVersionUpdate: (callback: (info: VersionUpdateInfo) => void) => {
  ipcRenderer.on(IPC.VERSION_UPDATE_AVAILABLE, (_event, info: VersionUpdateInfo) =>
    callback(info)
  );
},

openExternal: (url: string) => ipcRenderer.invoke(IPC.OPEN_EXTERNAL, url),
```

Import `VersionUpdateInfo` from `'../shared/types'`.

### 5. Register `open-external` handler (`src/main/ipc-handlers.ts`)

Add inside `registerIpcHandlers()`:
```typescript
ipcMain.handle(IPC.OPEN_EXTERNAL, async (_event, url: string) => {
  // Security: only allow https://github.com/ URLs
  if (typeof url === 'string' && url.startsWith('https://github.com/')) {
    const { shell } = await import('electron');
    await shell.openExternal(url);
  }
});
```

Import `shell` from `electron` at the top (or dynamic import as shown).

### 6. Integrate in `main.ts`

After `createWindow()` call in `initializeApp()`, add:
```typescript
// Non-blocking version check (fire-and-forget)
import { checkForUpdate } from './version-checker';
// ... in initializeApp(), after createWindow():
checkForUpdate(mainWindow!).catch(() => {});
```

Move the import to the top of the file with other imports.

</details>
