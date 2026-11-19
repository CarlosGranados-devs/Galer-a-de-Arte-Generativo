import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173,
    host: true,
    strictPort: true,
  },
  preview: {
    port: 4173,
  },
  optimizeDeps: {
    // sql.js se empaqueta con su build de navegador y carga el .wasm desde /public.
    include: ['sql.js'],
  },
  build: {
    target: 'es2020',
    sourcemap: false,
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
    reportCompressedSize: false,
  },
});
