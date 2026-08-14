// src/main/app-assets.ts
// Resolves bundled application assets (icon) for both dev and packaged builds.

import { app } from 'electron';
import { join } from 'path';
import { promises as fs } from 'fs';

/**
 * Absolute path to the application icon (PNG).
 *
 * In a packaged app the icon is copied into the resources directory via
 * `extraResource` (see forge.config.ts). In development it lives in the repo's
 * `assets/` directory, two levels up from the bundled main process output
 * (`.webpack/main`).
 */
export function getAppIconPath(): string {
  return app.isPackaged
    ? join(process.resourcesPath, 'icon.png')
    : join(__dirname, '..', '..', 'assets', 'icon.png');
}

/**
 * Read the application icon and return it as a base64 `data:` URI suitable for
 * an `<img src>` in the renderer. Returns null if the icon cannot be read.
 */
export async function getAppIconDataUri(): Promise<string | null> {
  try {
    const data = await fs.readFile(getAppIconPath());
    return `data:image/png;base64,${data.toString('base64')}`;
  } catch {
    return null;
  }
}
