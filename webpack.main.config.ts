import type { Configuration } from 'webpack';
import path from 'path';
import CopyWebpackPlugin from 'copy-webpack-plugin';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

export const mainConfig: Configuration = {
  /**
   * This is the main entry point for your application, it's the first file
   * that runs in the main process.
   */
  context: path.resolve(__dirname),
  entry: './src/index.ts',
  // Put your normal webpack config below here
  module: {
    rules,
  },
  plugins: [
    ...plugins,
    new CopyWebpackPlugin({
      patterns: [
        {
          from: 'node_modules/xmllint-wasm/xmllint.wasm',
          // Must match the path the asset relocator rewrites xmllint-node.js's
          // wasm reference to. webpack.rules.ts runs
          // @vercel/webpack-asset-relocator-loader with
          // outputAssetBase: 'native_modules', so the bundled loader requests
          // native_modules/xmllint.wasm. Emitting to the output root instead
          // leaves validation permanently unavailable in packaged builds.
          to: 'native_modules/xmllint.wasm',
        },
      ],
    }),
  ],
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css', '.json'],
  },
};
