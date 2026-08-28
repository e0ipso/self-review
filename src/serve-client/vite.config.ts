// src/serve-client/vite.config.ts
// Build configuration for the serve-mode browser client.
//
// Modelled on `tests/webapp/vite.config.ts`, which is the same application
// shape — mount the React package against an adapter — and is exercised by the
// `e2e` Playwright project. The two differ only in what they build for: that
// one is served by a dev server and never emits, this one emits the static
// bundle serve mode hands to the reviewer's browser.
//
// `outDir` is `<repo>/dist/serve-client`, which is the source-checkout
// candidate `src/main/serve/client-assets.ts` resolves. In a packaged build the
// same directory is copied to `<resources>/serve-client` by the `extraResource`
// entry in `forge.config.ts`, which is the candidate before it. Both names come
// from `CLIENT_DIR_NAME`; changing either one alone breaks one of the two.

import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      // The Node-free entry point, as the webpack renderer build and
      // `tests/webapp` both alias: `@self-review/core`'s index reaches into
      // `fs` and `child_process`, which have no meaning in a browser.
      '@self-review/core': path.resolve(__dirname, '../../packages/core/src/browser.ts'),
    },
  },
  build: {
    outDir: path.resolve(__dirname, '../../dist/serve-client'),
    // The directory is the unit the server serves and the packager copies; a
    // stale hashed asset left behind would be shipped with it.
    emptyOutDir: true,
  },
});
