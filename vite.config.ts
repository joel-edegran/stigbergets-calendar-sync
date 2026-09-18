import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: './src/index.ts',
      name: 'code',
      formats: ['iife'],
      fileName: () => 'code.gs',
    },
    rollupOptions: {
      external: [],
      output: {
        extend: true,
      },
    },
    target: 'esnext',
    minify: false,
  },
});