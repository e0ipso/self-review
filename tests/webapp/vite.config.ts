import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'path';

export default defineConfig({
  root: path.resolve(__dirname),
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@self-review/core': path.resolve(__dirname, '../../packages/core/src'),
    },
  },
  server: {
    port: 5199,
    strictPort: true,
  },
});
