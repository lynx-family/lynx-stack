// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { InitConfigsOptions, Rspack } from '@rsbuild/core'
import { rstest } from '@rstest/core'

import { createRspeedy } from '@lynx-js/rspeedy'
import type { Config, RspeedyInstance } from '@lynx-js/rspeedy'

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
    // Pin to the package root: rstest's cwd differs between per-package runs
    // and the root CI run, which would make cwd-derived snapshots unstable.
    cwd: cwd ?? path.join(path.dirname(fileURLToPath(import.meta.url)), '..'),
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
