import { defineConfig } from 'vite';
import { resolve } from 'node:path';

// Multi-page site: add each new page to `input` as it is built
// (e.g. services: resolve(import.meta.dirname, 'services.html')).
export default defineConfig({
  // Relative base so the build works at a domain root or a subfolder
  // (e.g. GitHub Pages: lwilliams027.github.io/williams-systems-llc/).
  base: './',
  server: {
    port: 5173,
    strictPort: false,
    open: false,
  },
  build: {
    rollupOptions: {
      input: {
        main: resolve(import.meta.dirname, 'index.html'),
        admin: resolve(import.meta.dirname, 'admin.html'),
      },
    },
  },
});
