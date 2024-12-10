import { defineConfig } from 'vite';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';

import { readFileSync, readdirSync, writeFileSync } from 'fs';
import { join, resolve } from 'path';

function buildShaders(watcher) {
  const src_dir = 'src/shader';

  const shader_codes = {};
  const files = readdirSync(src_dir);
  for (const file of files) {
    const buff = readFileSync(join(src_dir, file));
    const code = buff.toString('base64');
    shader_codes[file] = code;
    watcher.addWatchFile(resolve(__dirname, join(src_dir, file)));
  }

  const date = new Date().toISOString().replace('T', ' ').replace('Z', '');
  let shader_code = `
export const BUILD_TIME = "${date}";
export const shaders = ${JSON.stringify(shader_codes, null, 2)};
`;
  writeFileSync('src/shaders.ts', shader_code);
}

export default defineConfig({
  plugins: [
    {
      name: 'watch-external',
      async buildStart() {
        buildShaders(this);
      },
    },
    cssInjectedByJsPlugin(),
  ],
  build: {
    lib: {
      entry: './src/index.ts',
      name: 'webgui',
      fileName: () => 'webgui.js',
      formats: ['iife'],
    },
    minify: true,
    // only watch in dev mode
    watch: process.argv.includes('development')
      ? {
          exclude: 'src/shaders.ts',
        }
      : undefined,
  },
  resolve: {
    extensions: ['.tsx', '.ts', '.js'],
  },
});
