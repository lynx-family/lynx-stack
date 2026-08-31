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
import { rstest } from '@rstest/core'

import { pluginLynx } from '../src/index.js'
import type { LynxPluginOptions } from '../src/index.js'

interface RsbuildHelper {
  unwrapConfig(options?: InitConfigsOptions): Promise<Rspack.Configuration>
  usingDevServer(): Promise<{
    port: number
    urls: string[]
    waitDevCompileDone(timeout?: number): Promise<void>
    [Symbol.asyncDispose](): Promise<void>
  }>
}

export async function createStubRsbuild(
  rsbuildConfig: RsbuildConfig = {},
  cwd?: string,
  lynxOptions?: LynxPluginOptions,
): Promise<RsbuildInstance & RsbuildHelper> {
  const rsbuild = await createRsbuild({
    cwd: cwd ?? path.dirname(fileURLToPath(import.meta.url)),
    rsbuildConfig: {
      environments: { lynx: {} },
      ...rsbuildConfig,
      plugins: [pluginLynx(lynxOptions), ...(rsbuildConfig.plugins ?? [])],
    },
  })

  const helper: RsbuildHelper = {
    async unwrapConfig(options?: InitConfigsOptions) {
      const [config] = await rsbuild.initConfigs(options)
      return config!
    },

    async usingDevServer() {
      let done = false
      rsbuild.onAfterDevCompile({
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
