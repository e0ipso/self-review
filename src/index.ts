// Electron Forge main process entry point.
//
// CLI dispatch happens first. `self-review fetch-comments` writes a review
// file and exits, so it must not drag in src/main/main.ts and the window,
// menu and IPC machinery only a desktop launch needs. A launch that opens a
// window is the one case that loads it.
import { dispatchCli } from './main/cli-dispatch';

if (!dispatchCli()) {
  // A require, not an import. An import would be hoisted above the dispatch.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  require('./main/main');
}
