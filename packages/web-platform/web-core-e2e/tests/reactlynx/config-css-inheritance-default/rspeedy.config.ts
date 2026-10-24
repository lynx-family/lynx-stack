// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';
import { defineConfig } from '@lynx-js/rspeedy';
import { commonConfig } from '../commonConfig.js';

export default defineConfig({
  ...commonConfig(),
  source: {
    entry: {
      'config-css-inheritance-default': path.join(
        import.meta.dirname,
        '../config-css-inheritance-true/index.jsx',
      ),
    },
  },
});
