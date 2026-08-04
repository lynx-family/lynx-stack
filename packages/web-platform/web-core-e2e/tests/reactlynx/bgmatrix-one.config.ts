// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { mergeRspeedyConfig, type Config } from '@lynx-js/rspeedy';

import { commonConfig } from './commonConfig.js';

// One matrix case, one `enableMTSRendering` value, one build. Building the
// whole matrix in a single pass would share the mode across every entry —
// an entry whose boundary went undetected would then inherit "mode on" from
// a sibling, which is a different question from the one each case asks.
const name = process.env['BG_CASE']!;
const variant = process.env['BG_VARIANT']!;

const enableMTSRendering = variant === 'auto'
  ? undefined
  : variant === 'off'
  ? false
  : true;

const config: Config = mergeRspeedyConfig(
  commonConfig(
    enableMTSRendering === undefined ? {} : { enableMTSRendering },
  ),
  {
    source: {
      entry: {
        [`bg-${name}--${variant}`]: {
          import: path.join(
            import.meta.dirname,
            '..',
            'bgmatrix',
            name,
            'index.jsx',
          ),
          publicPath: '/dist/',
        },
      },
    },
  },
);

export default config;
