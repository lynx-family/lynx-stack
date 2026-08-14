// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core';

import { DEFAULT_GENUI_SERVER_URL } from './genui-server-url.js';

export default defineConfig({
  name: 'genui/genui-playground',
  include: ['src/**/*.test.ts'],
  source: {
    define: {
      __GENUI_SERVER_URL__: JSON.stringify(DEFAULT_GENUI_SERVER_URL),
    },
  },
});
