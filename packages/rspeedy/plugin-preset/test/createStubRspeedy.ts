// Copyright 2024 The Lynx Authors. All rights reserved.
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
import { pluginCssMinimizer } from '@rsbuild/plugin-css-minimizer'
import { rstest } from '@rstest/core'

import { pluginLynxDebugMetadata } from '@lynx-js/debug-metadata-rsbuild-plugin'

import type { Config } from '../src/config/index.js'
import {
  applyDefaultRspeedyConfig,
  pluginChunkLoading,
  pluginDev,
  pluginMinify,
  pluginOptimization,
  pluginOutput,
  pluginResolve,
  pluginRsdoctor,
  pluginSourcemap,
  pluginStatsJson,
  pluginSwc,
  pluginTarget,
  toRsbuildConfig,
} from '../src/internal.js'
import { pluginLynxAPI } from '../src/plugin-api.js'

interface RsbuildHelper {
  unwrapConfig(options?: InitConfigsOptions): Promise<Rspack.Configuration>
  usingDevServer(): Promise<{
    port: number
    urls: string[]
    waitDevCompileDone(timeout?: number): Promise<void>
    [Symbol.asyncDispose](): Promise<void>
  }>
}

/**
 * A standalone stub that composes the default Lynx plugins directly on top of
 * `createRsbuild` — the same set (and order) the Rspeedy CLI applies via
 * `applyDefaultPlugins`, threading the config through `pluginLynxAPI`. It lives
 * here (rather than reusing `@lynx-js/rspeedy`'s `createRspeedy`) so the preset
 * package does not depend back on the CLI, keeping the build graph acyclic.
 */
export async function createStubRspeedy(
  config: Config,
  cwd?: string,
): Promise<RsbuildInstance & RsbuildHelper> {
  const resolved = applyDefaultRspeedyConfig(config)

  const rsbuild = await createRsbuild({
    // Pin to the package root: rstest's cwd differs between per-package runs
    // and the root CI run, which would make cwd-derived snapshots unstable.
    cwd: cwd ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
    rsbuildConfig: toRsbuildConfig(resolved) as RsbuildConfig,
    callerName: 'rspeedy',
  })

  rsbuild.addPlugins([
    pluginLynxAPI(resolved),
    pluginChunkLoading(),
    pluginLynxDebugMetadata(),
    pluginDev(resolved.dev, resolved.server),
    pluginMinify(resolved.output?.minify),
    pluginOptimization(),
    pluginOutput(resolved.output),
    pluginResolve(),
    pluginRsdoctor(resolved.tools?.rsdoctor),
    pluginSourcemap(),
    pluginStatsJson(resolved),
    pluginSwc(),
    pluginTarget(),
    pluginCssMinimizer(),
  ])

  const helper: RsbuildHelper = {
    async unwrapConfig(options?: InitConfigsOptions) {
      const [config] = await rsbuild.initConfigs(options)
      return config!
    },

    async usingDevServer() {
      let done = false
      rsbuild.onDevCompileDone({
        handler: () => {
          done = true
        },
        // We make sure this is run at the last
        // Otherwise, we would call `compiler.close()` before getting stats.
        order: 'post',
      })

      const devServer = await rsbuild.createDevServer()

      const { server, port, urls } = await devServer.listen()

      return {
        port,
        urls,
        async waitDevCompileDone(timeout?: number) {
          await rstest.waitUntil(() => done, { timeout: timeout ?? 5000 })
        },
        async [Symbol.asyncDispose]() {
          return await server.close()
        },
      }
    },
  }

  return Object.assign(rsbuild, helper)
}
