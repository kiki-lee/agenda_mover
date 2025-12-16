import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
// Avoid Node-specific type imports to keep TS happy without @types/node

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      // Use Vite's root-relative aliases to avoid Node URL helpers
      '@utils': '/src/utils',
      '@components': '/src/components',
    },
  },
});
