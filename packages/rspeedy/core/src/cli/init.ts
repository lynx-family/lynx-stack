// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { Config } from '../config/index.js'
import { loadConfig } from '../config/loadConfig.js'
import type { CreateRspeedyOptions } from '../create-rspeedy.js'
import type { BuildOptions } from './build.js'
import type { DevOptions } from './dev.js'
import type { InspectOptions } from './inspect.js'
import type { PreviewOptions } from './preview.js'

export async function init(
  cwd: string,
  options: BuildOptions | DevOptions | InspectOptions | PreviewOptions,
): Promise<{
  configPath: string
  createRspeedyOptions: CreateRspeedyOptions
  rspeedyConfig: Config
}> {
  const { content: rspeedyConfig, configPath } = await loadConfig({
    cwd,
    configPath: options.config,
  })

  if (rspeedyConfig.performance?.buildCache) {
    if (rspeedyConfig.performance.buildCache === true) {
      rspeedyConfig.performance.buildCache = {
        buildDependencies: [configPath],
      }
    } else {
      rspeedyConfig.performance.buildCache.buildDependencies ??= []
      rspeedyConfig.performance.buildCache.buildDependencies.push(
        configPath,
      )
    }
  }

  const createRspeedyOptions: CreateRspeedyOptions = {
    cwd,
    rspeedyConfig,
  }

  if (options.noEnv) {
    createRspeedyOptions.loadEnv = false
  } else if (options.envMode) {
    createRspeedyOptions.loadEnv = { mode: options.envMode }
  }

  if ('base' in options && options.base) {
    rspeedyConfig.server ??= {}
    rspeedyConfig.server.base = options.base
  }

  if ('environment' in options && options.environment) {
    createRspeedyOptions.environment = options.environment
  }

  if (options.mode) {
    rspeedyConfig.mode = options.mode
  }

  return { createRspeedyOptions, configPath, rspeedyConfig }
}
