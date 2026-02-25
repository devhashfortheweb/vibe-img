// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node', // or 'jsdom' if you're testing browser code
    setupFiles: ['./vitest.setup.ts'], // optional
  },
});
