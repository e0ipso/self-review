import type { Configuration } from 'webpack';
import path from 'path';

import { baseRules } from './webpack.rules';
import { plugins } from './webpack.plugins';

export const rendererConfig: Configuration = {
  context: path.resolve(__dirname),
  module: {
    rules: [
      ...baseRules,
      // Stylesheets, including the @self-review/react sources src/index.css
      // imports and the CSS the MDEditor package imports itself. Prism themes
      // arrive through those sources already scoped; nothing is read as a string.
      {
        test: /\.css$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          {
            loader: 'postcss-loader',
            options: {
              postcssOptions: {
                plugins: [require('@tailwindcss/postcss')],
              },
            },
          },
        ],
      },
    ],
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
    alias: {
      '@self-review/core': path.resolve(__dirname, 'packages/core/src/browser.ts'),
    },
  },
};
