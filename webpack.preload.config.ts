import type { Configuration } from 'webpack';
import path from 'path';

import { baseRules } from './webpack.rules';
import { plugins } from './webpack.plugins';

export const preloadConfig: Configuration = {
  context: path.resolve(__dirname),
  module: {
    rules: [...baseRules],
  },
  plugins,
  resolve: {
    extensions: ['.js', '.ts', '.jsx', '.tsx'],
  },
};
