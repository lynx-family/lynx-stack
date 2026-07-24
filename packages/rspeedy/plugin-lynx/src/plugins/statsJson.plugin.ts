// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { mkdir, writeFile } from 'node:fs/promises'
import path from 'node:path'

import type { RsbuildPlugin } from '@rsbuild/core'

import { BUNDLE_STATS_JSON_OPTIONS } from './statsJsonOptions.js'
import type { Performance } from '../config/performance/index.js'

export function pluginStatsJson(performance?: Performance): RsbuildPlugin {
  return {
    name: 'lynx:stats-json',
    setup(api) {
      if (!performance?.profile) {
        return
      }

      api.onAfterBuild(async ({ stats }) => {
        if (!stats) {
          return
        }

        const statsPath = path.join(api.context.distPath, 'stats.json')
        await mkdir(path.dirname(statsPath), { recursive: true })
        await writeFile(
          statsPath,
          JSON.stringify(stats.toJson(BUNDLE_STATS_JSON_OPTIONS), null, 2),
        )
      })
    },
  }
}
