import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    alias: {
      '@shared': path.resolve(__dirname, '../shared/src'),
    },
    isolate: true,
  },
});
