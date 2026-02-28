import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';

export default defineConfig({
  plugins: [preact()],
  publicDir: false,
  server: {
    host: true,
    allowedHosts: ['vibeimg.local'],
  },

  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'VibeImg',
      fileName: (format) => format === 'iife' ? 'vibeimg.js' : 'vibeimg.esm.js',
      formats: ['iife', 'es'],
    },
  },
});
