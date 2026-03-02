// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { writeFileSync } from 'node:fs'
import { join } from 'node:path'

import type { RsbuildPlugin } from '@rsbuild/core'

export function pluginStats(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:stats',
    setup(api) {
      api.onAfterBuild(({ stats }) => {
        if (!stats) {
          return
        }
        const statsJson = stats.toJson({})

        writeFileSync(
          join(api.context.distPath, 'stats.json'),
          JSON.stringify(statsJson, null, 2),
        )
      })
    },
  }
}
