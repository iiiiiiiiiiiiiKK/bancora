import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

/**
 * Base path:
 *  - `BANCORA_BASE` wins when set (e.g. `/bancora/` for GitHub Pages project sites).
 *  - otherwise `/` for local dev/preview and root hosts (Cloudflare Pages, Vercel).
 */
export default defineConfig({
  base: process.env.BANCORA_BASE || '/',
  plugins: [react()],
  server: { port: 5173, strictPort: false },
  build: {
    outDir: 'dist',
    assetsDir: 'app',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          react: ['react', 'react-dom', 'react-router-dom'],
          zip: ['jszip'],
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.ts'],
    globals: false,
    testTimeout: 20000,
  },
});
