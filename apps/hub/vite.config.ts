import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';

export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? '0.1.0'),
  },
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: true,
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
