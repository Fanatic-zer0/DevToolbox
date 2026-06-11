import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          crypto: ['openpgp'],
          editor: ['@codemirror/state', '@codemirror/view', 'codemirror'],
          yaml: ['js-yaml'],
          sql: ['sql-formatter'],
          diff: ['diff'],
          qr: ['qrcode', 'jsqr'],
          forge: ['node-forge'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['openpgp'],
  },
});
