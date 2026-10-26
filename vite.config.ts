import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig(({ mode }) => ({
  root: 'web',
  // Separate development, builds and --mode verification servers to avoid cache replacement.
  cacheDir: `${root}node_modules/.vite/${mode}`,
  optimizeDeps: {
    include: [
      'echarts-for-react/esm/core',
      'echarts/core',
      'echarts/charts',
      'echarts/components',
      'echarts/renderers',
    ],
  },
  publicDir: fileURLToPath(new URL('./public', import.meta.url)),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@shared': `${root}shared`,
      '@': `${root}web/src`,
    },
  },
  server: {
    port: 5173,
    fs: { allow: [root] },
    proxy: {
      '/api': process.env.DEV_API_TARGET ?? 'http://localhost:3000',
    },
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
}));
