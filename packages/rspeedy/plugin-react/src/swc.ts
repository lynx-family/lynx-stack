// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

export function applySWC(api: RsbuildPluginAPI): void {
  api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
    const { output } = api.getRsbuildConfig()

    const inlineSourcesContent: boolean = output?.sourceMap === true || !(
      // `false`
      output?.sourceMap === false
      // `false`
      || output?.sourceMap?.js === false
      // explicitly disable source content
      || output?.sourceMap?.js?.includes('nosources')
    )

    return mergeRsbuildConfig({
      tools: {
        swc: {
          jsc: {
            transform: {
              // TODO: remove this in the next minor version
              useDefineForClassFields: false,
              optimizer: {
                simplify: true,
              },
              react: {
                throwIfNamespace: false,
                importSource: '@lynx-js/react',
                runtime: 'automatic',
              },
            },
            parser: {
              syntax: 'typescript',
              tsx: false,
              decorators: true,
            },
          },
          inlineSourcesContent,
        },
      },
    }, config)
  })
}
