// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { logger } from '@rsbuild/core'
import type { RsbuildPlugin } from '@rsbuild/core'
import { rstest } from '@rstest/core'

import type { Config, ExposedAPI } from '@lynx-js/rspeedy'

export const pluginStubRspeedyAPI = (config: Config = {}): RsbuildPlugin => ({
  name: 'lynx:rsbuild:plugin-api',
  setup(api) {
    api.expose<ExposedAPI>(Symbol.for('rspeedy.api'), {
      debug: rstest.fn((message: string | (() => string)) => {
        if (typeof message === 'function') {
          message = message()
        }
        console.info(message)
      }),
      logger,
      config,
      exit: rstest.fn(),
      version: '0.0.0',
    })
  },
})
