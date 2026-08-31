// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Rspack } from '@rslib/core'

import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { getWebEncodeMode } from './webEncode.js'

const PLUGIN_NAME = 'WebExternalBundleEncodePlugin'

interface Options {
  LynxTemplatePlugin: {
    getLynxTemplatePluginHooks:
      typeof LynxTemplatePlugin.getLynxTemplatePluginHooks
  }
}

/**
 * Encodes an external bundle for the web platform, in place of
 * `LynxEncodePlugin`.
 */
export class WebExternalBundleEncodePlugin {
  constructor(private options: Options) {}

  apply(compiler: Rspack.Compiler): void {
    const webEncode = getWebEncodeMode()

    compiler.hooks.thisCompilation.tap(PLUGIN_NAME, (compilation) => {
      const hooks = this.options.LynxTemplatePlugin
        .getLynxTemplatePluginHooks(compilation)

      hooks.encode.tapPromise(PLUGIN_NAME, async ({ encodeOptions }) => {
        const { buffer } = await webEncode(encodeOptions)
        return { buffer, debugInfo: '' }
      })
    })
  }
}
