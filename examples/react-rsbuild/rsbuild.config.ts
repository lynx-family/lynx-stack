// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { defineConfig } from '@rsbuild/core';

import {
  loadLynxConfig,
  pluginLynxPreset,
} from '@lynx-js/preset-rsbuild-plugin';
import { pluginQRCode } from '@lynx-js/qrcode-rsbuild-plugin';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

// Progressive migration: the existing `lynx.config.ts` is loaded as-is and fed
// to `pluginLynxPreset()`. `defineConfig` accepts an async factory, so the
// config can be loaded before the plugins are composed.
export default defineConfig(async () => ({
  plugins: [
    pluginLynxPreset(await loadLynxConfig()),
    pluginReactLynx(),
    pluginQRCode({
      fullscreen: true,
    }),
  ],
  environments: {
    web: {},
    lynx: {},
  },
}));
