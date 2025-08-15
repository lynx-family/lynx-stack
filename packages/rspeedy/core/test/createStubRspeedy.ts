// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { InitConfigsOptions, Rspack } from '@rsbuild/core'
import { vi } from 'vitest'

import { createRspeedy } from '../src/index.js'
import type { Config, RspeedyInstance } from '../src/index.js'

interface RsbuildHelper {
  unwrapConfig(options?: InitConfigsOptions): Promise<Rspack.Configuration>
  usingDevServer(): Promise<{
    port: number
    urls: string[]
    waitDevCompileDone(timeout?: number): Promise<void>
    [Symbol.asyncDispose](): Promise<void>
  }>
}

export async function createStubRspeedy(
  config: Config,
  cwd?: string,
): Promise<RspeedyInstance & RsbuildHelper> {
  const rsbuild = await createRspeedy({
    rspeedyConfig: config,
    cwd: cwd ?? process.cwd(),
  })

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
          await vi.waitUntil(() => done, { timeout: timeout ?? 5000 })
        },
        async [Symbol.asyncDispose]() {
          return await server.close()
        },
      }
    },
  }

  return Object.assign(rsbuild, helper)
}
