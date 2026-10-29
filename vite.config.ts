import { defineConfig } from 'vite';

export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    lib: {
      entry: './src/index.ts',
      formats: ['es'],
      fileName: () => 'code.gs',
    },
    rollupOptions: {
      external: [],
    },
    target: 'esnext',
    minify: false,
  },
});