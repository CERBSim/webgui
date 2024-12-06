import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

export default defineConfig({
  plugins: [cssInjectedByJsPlugin()],
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'webgui',
      fileName: () => 'webgui.js',
      formats: ['iife'],
    },
    minify: true,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
});
