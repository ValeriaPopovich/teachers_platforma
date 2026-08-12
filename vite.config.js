import { fileURLToPath, URL } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@icons': fileURLToPath(new URL('./packages/icons/index.js', import.meta.url)),
      '@ui': fileURLToPath(new URL('./packages/ui/index.js', import.meta.url)),
    },
  },
});
