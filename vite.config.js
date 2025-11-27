import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 3000,
    open: true // Auto-open browser
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'tabulator': ['tabulator-tables'],
          'interact': ['interactjs']
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
});
