// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import { pluginReactAlias } from '@lynx-js/react-alias-rsbuild-plugin'
import { LAYERS } from '@lynx-js/react-webpack-plugin'

export function applyAlias(
  api: RsbuildPluginAPI,
  lazy?: boolean,
): void | Promise<void> {
  return pluginReactAlias({
    LAYERS,
    lazy,
    rootPath: api.context.rootPath,
  }).setup(api)
}
