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
          // Core React runtime — always needed
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          // State / search utilities
          'vendor-utils': ['zustand', 'fuse.js', 'clsx', 'tailwind-merge'],
          // Icon library (large at ~2 MB unminified)
          'vendor-icons': ['lucide-react'],
          // All CodeMirror packages together
          'editor': [
            'codemirror',
            '@codemirror/state',
            '@codemirror/view',
            '@codemirror/commands',
            '@codemirror/language',
            '@codemirror/theme-one-dark',
            '@codemirror/lang-javascript',
            '@codemirror/lang-json',
            '@codemirror/lang-html',
            '@codemirror/lang-css',
            '@codemirror/lang-xml',
            '@codemirror/lang-sql',
            '@codemirror/lang-markdown',
          ],
          // Crypto / PKI — heaviest chunks
          'crypto-pgp':   ['openpgp'],
          'crypto-forge':  ['node-forge'],
          'crypto-js':    ['crypto-js'],
          // Data / serialisation
          'lib-yaml':     ['js-yaml'],
          'lib-sql':      ['sql-formatter'],
          'lib-diff':     ['diff'],
          'lib-markdown': ['marked', 'cronstrue'],
          // QR
          'lib-qr':       ['qrcode', 'jsqr'],
          // IDs
          'lib-ids':      ['uuid', 'ulidx'],
        },
      },
    },
  },
  optimizeDeps: {
    include: ['openpgp'],
  },
});
