import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
  },
  resolve: {
    alias: [
      { find: '@', replacement: path.resolve(__dirname, './src') },
      {
        find: '@antiphon/ui/styles.css',
        replacement: path.resolve(__dirname, '../../packages/ui/src/styles.css'),
      },
      { find: '@antiphon/core', replacement: path.resolve(__dirname, '../../packages/core/src/index.ts') },
      { find: '@antiphon/api', replacement: path.resolve(__dirname, '../../packages/api/src/index.ts') },
      { find: '@antiphon/ui', replacement: path.resolve(__dirname, '../../packages/ui/src/index.ts') },
      { find: '@antiphon/motion', replacement: path.resolve(__dirname, '../../packages/motion/src/index.ts') },
    ],
  },
});
