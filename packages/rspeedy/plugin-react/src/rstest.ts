// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

export function applyRstest(api: RsbuildPluginAPI): void {
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    return mergeRsbuildConfig({
      output: {
        // Allow using Node.js internal modules in testing framework directly
        externals: /^node:/,
      },
    }, config)
  })

  // stub the `rspeedy.api`
  api.expose(Symbol.for('rspeedy.api'), {
    debug: (message: string | (() => string)) => {
      if (typeof message === 'function') {
        message = message()
      }
      console.info(message)
    },
    logger: api.logger,
    config: api.getRsbuildConfig('current'),
    exit: () => {
      // do nothing
    },
    version: '0.0.0',
  })
}
