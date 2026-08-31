// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'

import { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

export function pluginTemplate(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:template',
    setup(api) {
      // Only `getLynxTemplatePluginHooks` is exposed, so the rest of
      // `LynxTemplatePlugin` stays free to change without breaking the
      // plugins that tap its hooks.
      api.expose(Symbol.for('LynxTemplatePlugin'), {
        LynxTemplatePlugin: {
          getLynxTemplatePluginHooks: LynxTemplatePlugin
            .getLynxTemplatePluginHooks.bind(LynxTemplatePlugin),
        },
      })
    },
  }
}
