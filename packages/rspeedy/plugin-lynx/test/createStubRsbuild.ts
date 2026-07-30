// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import type {
  InitConfigsOptions,
  RsbuildConfig,
  RsbuildInstance,
  Rspack,
} from '@rsbuild/core'

import { pluginLynx } from '../src/index.js'

export async function createStubRsbuild(
  rsbuildConfig: RsbuildConfig = {},
  cwd?: string,
): Promise<
  RsbuildInstance & {
    unwrapConfig(options?: InitConfigsOptions): Promise<Rspack.Configuration>
  }
> {
  const rsbuild = await createRsbuild({
    cwd: cwd ?? path.dirname(fileURLToPath(import.meta.url)),
    rsbuildConfig: {
      environments: { lynx: {} },
      ...rsbuildConfig,
      plugins: [pluginLynx(), ...(rsbuildConfig.plugins ?? [])],
    },
  })

  return Object.assign(rsbuild, {
    async unwrapConfig(options?: InitConfigsOptions) {
      const [config] = await rsbuild.initConfigs(options)
      return config!
    },
  })
}
