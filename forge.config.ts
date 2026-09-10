import type { ForgeConfig } from '@electron-forge/shared-types';
import { spawnSync } from 'child_process';
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

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    // No asarUnpack key here. aab79af added `asarUnpack: ['**/xmllint.wasm']`
    // meaning to keep the wasm reachable outside the archive, but that name
    // belongs to electron-builder; @electron/packager spells it
    // `asar: { unpack: <glob> }`, so Forge has been dropping the key on the
    // floor ever since. A packaged tree has no app.asar.unpacked directory and
    // carries the file at /.webpack/main/native_modules/xmllint.wasm inside
    // app.asar. Nothing broke, because xmllint-wasm loads it with
    // fs.readFileSync(__dirname + '/xmllint.wasm') and Electron's asar patch
    // serves that read from inside the archive. SR-0078 dropped the dead key
    // when it put this file under tsc rather than translate it, which would
    // have changed what ships on the strength of no evidence that unpacking is
    // needed. SR-0081 then measured it on the packaged Linux binary rather
    // than leaving it inferred. Finishing a review wrote a review.xml that
    // xmllint validates against self-review-v3.xsd, with no "validation
    // infrastructure failed" warning on stderr, and the guide loader read the
    // same wasm both ways, accepting a valid sidecar and rejecting an invalid
    // one with libxml2's own "No matching global declaration available for the
    // validation root" error. Unpacking is not needed.
    // On macOS the binary name inside the .app bundle is derived from
    // productName and doesn't need overriding.  Only set executableName on
    // Linux where it controls the CLI command name.
    ...(process.platform !== 'darwin' && { executableName: 'self-review' }),
    icon: './assets/icon',
    extraResource: ['./assets/icon.png'],
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
      devContentSecurityPolicy: `default-src 'none'; script-src 'self' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://localhost:${devPort} ws://127.0.0.1:${devPort} ws://[::1]:${devPort}; object-src 'none'; frame-src 'none'; worker-src 'none'; base-uri 'none'; form-action 'none'`,
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
};

export default config;
