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

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    asarUnpack: ['**/xmllint.wasm'],
  },
  rebuildConfig: {},
  makers: [
    new MakerSquirrel({}),
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      port: devPort,
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
