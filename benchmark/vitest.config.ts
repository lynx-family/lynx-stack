// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import codspeedVitestPlugin from '@codspeed/vitest-plugin';
import { defineConfig } from 'vitest/config';
import type { ViteUserConfig } from 'vitest/config';

const config: ViteUserConfig = defineConfig({
  plugins: [codspeedVitestPlugin()],
});

export default config;
