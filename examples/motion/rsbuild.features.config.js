// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rsbuild/core';

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';
import { pluginLynx } from '@lynx-js/rsbuild-plugin';

const variant = process.env['MOTION_FEATURE_VARIANT'] ?? 'full';
if (!['full', 'mini', 'values'].includes(variant)) {
  throw new Error('MOTION_FEATURE_VARIANT must be full, mini, or values');
}
export default defineConfig({
  environments: { lynx: {}, web: {} },
  source: { entry: { features: `./src/FeatureTests/${variant}.tsx` } },
  output: { distPath: { root: `dist/features-${variant}` } },
  plugins: [pluginLynx(), pluginReactLynx({ enableCSSSelector: true })],
});
