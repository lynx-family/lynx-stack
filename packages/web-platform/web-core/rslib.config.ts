import { defineConfig } from '@rslib/core';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const cleanJsFiles = (dir: string) => {
  if (!fs.existsSync(dir)) return;
  for (const file of fs.readdirSync(dir)) {
    const fullPath = path.join(dir, file);
    if (fs.statSync(fullPath).isDirectory()) {
      cleanJsFiles(fullPath);
    } else if (fullPath.endsWith('.js')) {
      fs.unlinkSync(fullPath);
    }
  }
};

cleanJsFiles(path.join(__dirname, 'dist/server'));

export default defineConfig({
  lib: [
    {
      format: 'esm',
      syntax: 'esnext',
      dts: false,
    },
  ],
  source: {
    entry: {
      index: './ts/server/index.ts',
    },
  },
  output: {
    target: 'node',
    externals: [
      /\.wasm$/,
      /binary\/server\/.*\.js$/,
    ],
    cleanDistPath: false,
    distPath: {
      root: './dist/server',
    },
  },
});
