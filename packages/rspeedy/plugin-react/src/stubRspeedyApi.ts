// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import type { ExposedAPI } from '@lynx-js/rspeedy'

export function applyStubRspeedyAPI(api: RsbuildPluginAPI): void {
  api.expose<ExposedAPI>(Symbol.for('rspeedy.api'), {
    debug: (message: string | (() => string)) => {
      if (typeof message === 'function') {
        message = message()
      }
      console.info(message)
    },
    logger: api.logger,
    // @ts-expect-error Use Rsbuild config to approximate Rspeedy config
    config: api.getRsbuildConfig('current'),
    exit: () => {
      // do nothing
    },
    version: '0.0.0',
  })
}
