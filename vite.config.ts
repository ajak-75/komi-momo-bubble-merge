import { defineConfig } from 'vite';

// GitHub Pages project site: https://ajak-75.github.io/komi-momo-bubble-merge/
// The build is written into /docs so Pages can serve it straight from the main branch
// without any GitHub Actions workflow. A relative base keeps the same build working
// from /docs on Pages as well as from any static file host or CDN preview.
export default defineConfig({
  base: './',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: 'es2019',
    assetsDir: 'build',
  },
  server: { host: '127.0.0.1', port: 5173 },
});
