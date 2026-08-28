import type { ForgeConfig } from '@electron-forge/shared-types';
import { spawnSync } from 'child_process';
import * as path from 'path';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

import { mainConfig } from './webpack.main.config';
import { rendererConfig } from './webpack.renderer.config';
import { preloadConfig } from './webpack.preload.config';

/**
 * Find an available TCP port. Tries the preferred port first, falls back to an OS-assigned port.
 */
function getAvailablePort(preferred = 3000): number {
  const script = `
    const s = require('net').createServer();
    s.listen(${preferred}, () => {
      process.stdout.write(String(s.address().port));
      s.close();
    });
    s.on('error', () => {
      s.listen(0, () => {
        process.stdout.write(String(s.address().port));
        s.close();
      });
    });
  `;
  const result = spawnSync('node', ['-e', script], {
    encoding: 'utf-8',
    timeout: 5000,
  });
  const port = parseInt(result.stdout.trim(), 10);
  return isNaN(port) || port < 1024 ? preferred : port;
}

const devPort = getAvailablePort(3000);
const devLoggerPort = getAvailablePort(9000);

/**
 * Build the serve-mode browser client into `dist/serve-client`.
 *
 * Invoked from `prePackage` rather than `generateAssets` on purpose:
 * `generateAssets` also runs on `electron-forge start`, which would add this
 * build to every desktop development launch, and the desktop app does not use
 * these assets at all. `prePackage` runs for `package` and `make` only, and it
 * runs before the packager copies `extraResource` — which is what lets the
 * bundle be listed there unconditionally and still package from a clean tree
 * with no prior client build.
 *
 * The Vite binary is invoked directly, the way `tests/webapp-steps/app.ts`
 * already does, because `spawnSync('npm', ...)` needs a shell on Windows and
 * this config produces Windows artifacts. `npm run client:build` runs the same
 * command for anyone building the client by hand.
 */
function buildServeClient(): void {
  const viteBin = path.resolve(
    __dirname,
    'node_modules/.bin',
    process.platform === 'win32' ? 'vite.cmd' : 'vite'
  );
  const result = spawnSync(viteBin, ['build', '--config', 'src/serve-client/vite.config.ts'], {
    cwd: __dirname,
    stdio: 'inherit',
  });
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    throw new Error(
      `Building the serve-mode client failed (exit ${result.status}). ` +
        'Packaging cannot continue: dist/serve-client is an extraResource.'
    );
  }
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    asarUnpack: ['**/xmllint.wasm'],
    // On macOS the binary name inside the .app bundle is derived from
    // productName and doesn't need overriding.  Only set executableName on
    // Linux where it controls the CLI command name.
    ...(process.platform !== 'darwin' && { executableName: 'self-review' }),
    icon: './assets/icon',
    // `serve-client` lands at `<resources>/serve-client`, which is the
    // packaged-build candidate `src/main/serve/client-assets.ts` resolves. The
    // `prePackage` hook below guarantees the directory exists — a missing
    // `extraResource` path fails the packager outright.
    extraResource: ['./assets/icon.png', './dist/serve-client'],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin', 'linux']),
    new MakerRpm({
      options: {
        name: 'self-review',
        bin: 'self-review',
        icon: './assets/icon.png',
        homepage: 'https://github.com/e0ipso/self-review',
        description: 'GitHub-style PR review UI for local git diffs',
        categories: ['Development'],
        genericName: 'Code Review Tool',
      },
    }),
    new MakerDeb({
      options: {
        name: 'self-review',
        bin: 'self-review',
        icon: './assets/icon.png',
        homepage: 'https://github.com/e0ipso/self-review',
        description: 'GitHub-style PR review UI for local git diffs',
        categories: ['Development'],
        genericName: 'Code Review Tool',
        section: 'devel',
      },
    }),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      devContentSecurityPolicy: "default-src 'self' 'unsafe-inline' data: blob:; script-src 'self' 'unsafe-eval' 'unsafe-inline' data:",
      port: devPort,
      loggerPort: devLoggerPort,
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            html: './src/index.html',
            js: './src/renderer.ts',
            name: 'main_window',
            preload: {
              js: './src/preload.ts',
              config: preloadConfig,
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
  hooks: {
    prePackage: async () => {
      buildServeClient();
    },
  },
};

export default config;
