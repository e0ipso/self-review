import type { Configuration } from 'webpack';

import { baseRules } from './webpack.rules';
import { plugins } from './webpack.plugins';

export const rendererConfig: Configuration = {
  module: {
    rules: [
      ...baseRules,
      // Raw CSS imports (e.g., Prism themes) — imported as strings, not injected
      {
        test: /\.css$/,
        resourceQuery: /raw/,
        type: 'asset/source',
      },
      {
        test: /\.css$/,
        resourceQuery: { not: [/raw/] },
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
  },
};
