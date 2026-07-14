// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import { LynxAsyncChunkLayoutPlugin } from '@lynx-js/template-webpack-plugin'

export function applyAsyncChunkLayout(api: RsbuildPluginAPI): void {
  api.modifyBundlerChain((chain) => {
    chain.plugin('lynx:async-chunk-layout').use(LynxAsyncChunkLayoutPlugin)
  })
}
