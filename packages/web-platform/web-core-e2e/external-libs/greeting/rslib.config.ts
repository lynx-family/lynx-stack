// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path';

import { defineExternalBundleRslibConfig } from '@lynx-js/lynx-bundle-rslib-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

// Builds a real external `.lynx.bundle` as a WEB binary bundle (decodable by
// @lynx-js/web-core). The `greeting` entry is emitted as a `greeting`
// (background) section, a `greeting__main-thread` section, and a CSS section,
// served to the e2e dev server from `resources/external-bundle/`.
export default defineExternalBundleRslibConfig(
  {
    source: {
      entry: {
        greeting: path.join(import.meta.dirname, 'src', 'index.ts'),
      },
    },
    id: 'greeting',
    output: {
      distPath: {
        root: path.join(
          import.meta.dirname,
          '..',
          '..',
          'resources',
          'external-bundle',
        ),
      },
    },
    tools: {
      rspack: {
        output: {
          publicPath: 'auto',
        },
      },
    },
    plugins: [pluginReactLynx()],
  },
  { target: 'web', engineVersion: '3.5' },
);
