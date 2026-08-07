// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

const DEFAULT_SERVER_HOST = '0.0.0.0'

export function pluginServer(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:server',
    setup(api) {
      api.modifyRsbuildConfig({
        handler: (config, { mergeRsbuildConfig }) => {
          if (api.getRsbuildConfig('original').server?.host !== undefined) {
            return config
          }
          // Lynx devices connect to the dev and preview servers over LAN, so
          // we override the default value of Rsbuild(`localhost`) here.
          return mergeRsbuildConfig(config, {
            server: { host: DEFAULT_SERVER_HOST },
          })
        },
        order: 'pre',
      })
    },
  }
}
