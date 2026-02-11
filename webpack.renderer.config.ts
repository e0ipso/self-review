import type { Configuration } from 'webpack';

import { rules } from './webpack.rules';
import { plugins } from './webpack.plugins';

// Raw CSS imports (e.g., Prism themes) — imported as strings, not injected
rules.push({
  test: /\.css$/,
  resourceQuery: /raw/,
  type: 'asset/source',
});

rules.push({
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
});

export const rendererConfig: Configuration = {
  module: {
    rules,
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx', '.css'],
  },
};
