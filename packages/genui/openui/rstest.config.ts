// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';

import { withDefaultConfig } from '@lynx-js/react/testing-library/rstest-config';
import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin';

export default defineConfig({
  extends: withDefaultConfig({
    modifyRstestConfig(config) {
      return {
        ...config,
        name: 'genui/openui',
        include: ['test/**/*.test.{ts,tsx}'],
        plugins: [pluginReactLynx()],
      };
    },
  }),
});
