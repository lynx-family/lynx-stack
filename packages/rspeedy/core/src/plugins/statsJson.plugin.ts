// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

import type { RsbuildPlugin } from '@rsbuild/core'

import type { Config } from '../config/index.js'

export function pluginStatsJson(config: Config): RsbuildPlugin {
  return {
    name: 'lynx:stats-json',
    setup(api) {
      if (!config.performance?.profile) {
        return
      }

      api.onAfterBuild(({ stats }) => {
        if (!stats) {
          return
        }

        const statsPath = path.join(api.context.distPath, 'stats.json')
        mkdirSync(path.dirname(statsPath), { recursive: true })
        writeFileSync(
          statsPath,
          JSON.stringify(stats.toJson({ all: true }), null, 2),
        )
      })
    },
  }
}
