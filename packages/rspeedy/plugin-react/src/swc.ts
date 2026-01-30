// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

export function applySWC(api: RsbuildPluginAPI): void {
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    return mergeRsbuildConfig(
      {
        tools: {
          swc: {
            jsc: {
              transform: {
                useDefineForClassFields: false,
                optimizer: {
                  simplify: true,
                },
              },
              parser: {
                syntax: 'typescript',
                tsx: false,
                decorators: true,
              },
            },
          },
        },
      },
      config,
      {
        tools: {
          swc(config) {
            // Avoid error: "`env` and `jsc.target` cannot be used together"
            // since rslib will set env by default, we need to clear it
            delete config.env
            return config
          },
        },
      },
    )
  })
}
