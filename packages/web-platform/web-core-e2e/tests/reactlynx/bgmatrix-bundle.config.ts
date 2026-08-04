// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import fs from 'node:fs';
import path from 'node:path';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import type { Config } from '@lynx-js/rspeedy';

// The web build packs both threads into one artifact, so it cannot answer
// "did the deferred code leave the *main-thread* chunk". This builds the same
// sources for Lynx, where `main-thread.js` is its own asset.
const name = process.env['BG_CASE']!;
const variant = process.env['BG_VARIANT']!;

const enableMTSRendering = variant === 'auto'
  ? undefined
  : variant === 'off'
  ? false
  : true;

const config: Config = {
  plugins: [
    pluginReactLynx(
      enableMTSRendering === undefined ? {} : { enableMTSRendering },
    ),
  ],
  source: {
    entry: {
      main: path.join(import.meta.dirname, '..', 'bgmatrix', name, 'index.jsx'),
    },
  },
  output: {
    distPath: { root: `dist-bundle/${name}--${variant}` },
    cleanDistPath: false,
  },
  splitChunks: false,
  tools: {
    rspack: {
      plugins: [{
        name: 'dump-main-thread',
        apply(compiler: { hooks: Record<string, any> }) {
          compiler.hooks.compilation.tap('dump', (compilation: any) => {
            compilation.hooks.processAssets.tap('dump', (assets: any) => {
              for (const asset of Object.keys(assets)) {
                if (!asset.endsWith('main-thread.js')) continue;
                const out = path.resolve(
                  `dist-bundle/${name}--${variant}`,
                  'main-thread.dump.js',
                );
                fs.mkdirSync(path.dirname(out), { recursive: true });
                fs.writeFileSync(out, assets[asset].source().toString());
              }
            });
          });
        },
      }],
    },
  },
};

export default config;
