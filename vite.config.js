import { fileURLToPath, URL } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import { configDefaults } from 'vitest/config';

export default defineConfig({
  plugins: [vue(), tailwindcss()],
  build: {
    rollupOptions: {
      input: {
        app: fileURLToPath(new URL('./index.html', import.meta.url)),
        404: fileURLToPath(new URL('./404.html', import.meta.url)),
      },
    },
  },
  resolve: {
    alias: {
      '@icons': fileURLToPath(new URL('./packages/icons/index.js', import.meta.url)),
      '@ui': fileURLToPath(new URL('./packages/ui/index.js', import.meta.url)),
      '@use': fileURLToPath(new URL('./packages/use/index.js', import.meta.url)),
    },
  },
  test: {
    // Stray isolated-worktree checkouts under .claude/ carry their own tests/
    // dir; without this they'd get picked up and run a second time.
    exclude: [...configDefaults.exclude, '**/.claude/**'],
  },
});
