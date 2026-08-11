// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { defineConfig } from '@rstest/core'
import type { RstestConfig } from '@rstest/core'

import { lynxRstestConfig } from '@lynx-js/test-tools/rstest-config'

const config: RstestConfig = defineConfig({
  ...lynxRstestConfig({
    name: 'rspeedy/vanilla',
    url: import.meta.url,
    setupFiles: ['@lynx-js/test-tools/setup-rspeedy'],
    env: { NODE_ENV: 'test' },
  }),
})

export default config
