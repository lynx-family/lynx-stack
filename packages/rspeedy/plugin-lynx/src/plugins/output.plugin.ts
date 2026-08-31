// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'

import { getLynxConfig } from '../config.js'

export function pluginOutput(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:output',
    setup(api) {
      if (
        api.context.callerName === 'rslib'
        || api.context.callerName === 'rstest'
      ) {
        return
      }
      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        const original = api.getRsbuildConfig('original')
        const originalFilename = typeof original.output?.filename === 'object'
          ? original.output.filename
          : undefined
        const originalDistPath = typeof original.output?.distPath === 'object'
          ? original.output.distPath
          : undefined

        return mergeRsbuildConfig(
          {
            // Default bundler-generated runtime / wrapper code to `var`
            // (QuickJS parses it faster than `const`/`let`); the SWC
            // `transform-block-scoping` pass handles user source separately.
            // Placed first so user-provided
            // `tools.rspack.output.environment.const` can opt out.
            tools: {
              // Lynx does not use HTML.
              htmlPlugin: false,
              rspack: { output: { environment: { const: false } } },
            },
          },
          config,
          {
            output: {
              distPath: {
                // We override the default value of Rsbuild(`static/css`) here.
                // Since all the CSS should be encoded into the template in
                // Lynx.
                css: originalDistPath?.css
                  ?? getLynxConfig(api).resolveIntermediateDir(),
              },
              filename: {
                css: originalFilename?.css ?? '[name]/[name].css',
              },
              // A Lynx bundle has nowhere to link a separate license file to.
              legalComments: original.output?.legalComments ?? 'none',
            },
          },
        )
      })
    },
  }
}
