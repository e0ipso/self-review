// Build the browser client into the one directory the server serves from.
//
// `CLIENT_DIR` in src/server.ts is `dist/client/` next to the built server, so
// that is the output directory here — there is exactly one, and no second
// resolution case to keep in step.
//
// Ordering matters: this must run *after* tsup, whose `clean: true` wipes
// `dist/` wholesale and would take the client assets with it. See the `build`
// script in package.json.

import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  root: fileURLToPath(new URL('./src/client', import.meta.url)),
  // Relative asset URLs, so the served page does not depend on being mounted
  // at the site root.
  base: './',
  // Vite's own esbuild transform handles the TSX; the React plugin would only
  // add a dev-time fast-refresh runtime this build never uses.
  esbuild: { jsx: 'automatic' },
  build: {
    outDir: fileURLToPath(new URL('./dist/client', import.meta.url)),
    // The output directory is outside `root`, which Vite refuses to empty
    // unless told to.
    emptyOutDir: true,
    // No sourcemaps. `files: ["dist"]` ships this directory in the published
    // tarball, and the maps were roughly three quarters of it — a poor trade for
    // a package whose point is being installable on a machine that cannot run
    // the desktop app. The server build keeps its maps; only the browser bundle
    // drops them.
  },
});
