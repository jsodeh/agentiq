import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/orchestrator/index.ts'),
      formats: ['es'],
      fileName: 'index',
    },
    outDir: 'dist/orchestrator',
    rollupOptions: {
      external: [
        '@anthropic-ai/sdk',
        'better-sqlite3',
        'p-queue',
        'zod',
        'composio-core',
        'playwright',
        '@tauri-apps/api/event',
        '@tauri-apps/api/core',
        '@tauri-apps/api/path',
        'path',
        'fs',
        'os',
        'crypto',
        'stream',
        'util',
        'events',
        'buffer',
      ],
    },
    minify: false,
    sourcemap: true,
  },
});
