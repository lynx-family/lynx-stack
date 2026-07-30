// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'

import { pluginChunkLoading } from './plugins/chunkLoading.plugin.js'
import { pluginOptimization } from './plugins/optimization.plugin.js'
import { pluginResolve } from './plugins/resolve.plugin.js'
import { pluginSwc } from './plugins/swc.plugin.js'
import { pluginTarget } from './plugins/target.plugin.js'

/**
 * @public
 */
export function pluginLynx(): RsbuildPlugin[] {
  return [
    pluginChunkLoading(),
    pluginOptimization(),
    pluginResolve(),
    pluginSwc(),
    pluginTarget(),
  ]
}
