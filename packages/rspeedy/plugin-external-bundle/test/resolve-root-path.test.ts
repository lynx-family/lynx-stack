// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { afterEach, describe, expect, it, vi } from 'vitest'

const resolveMock = vi.fn((id: string, options?: { paths?: string[] }) =>
  (options?.paths?.length ?? 0) > 0
    ? `${options!.paths![0]}/${id}.js`
    : `/default/${id}.js`
)

async function loadModule() {
  vi.resetModules()
  vi.doMock('node:module', () => ({
    createRequire: () => ({
      resolve: resolveMock,
    }),
  }))

  return import('../src/index.js')
}

describe('pluginExternalBundle reactlynx peer resolution', () => {
  afterEach(() => {
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('resolves @lynx-js/react-umd from the rsbuild rootPath', async () => {
    vi.stubEnv('NODE_ENV', 'development')
    const { pluginExternalBundle } = await loadModule()

    const plugin = pluginExternalBundle({
      externalsPresets: {
        reactlynx: true,
      },
    })

    await plugin.setup?.({
      context: {
        rootPath: '/virtual/app',
      },
      modifyRsbuildConfig(
        callback: (
          config: Record<string, unknown>,
          utils: {
            mergeRsbuildConfig: (
              base: Record<string, unknown>,
              extra: Record<string, unknown>,
            ) => Record<string, unknown>
          },
        ) => Record<string, unknown>,
      ) {
        callback(
          {},
          {
            mergeRsbuildConfig(base, extra) {
              return {
                ...base,
                ...extra,
              }
            },
          },
        )
      },
      modifyRspackConfig(
        callback: (config: { plugins?: unknown[] }) => { plugins?: unknown[] },
      ) {
        callback({ plugins: [] })
      },
      getRsbuildConfig() {
        return {}
      },
      useExposed() {
        return {
          BACKGROUND: 'background',
          MAIN_THREAD: 'main-thread',
        }
      },
    } as never)

    expect(resolveMock).toHaveBeenCalledWith('@lynx-js/react-umd/dev', {
      paths: ['/virtual/app'],
    })
  })
})
