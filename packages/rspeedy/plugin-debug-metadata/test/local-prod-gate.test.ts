// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin } from '@rsbuild/core'
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest'

import { pluginLynxDebugMetadata } from '../src/pluginLynxDebugMetadata.js'

interface ChainUtils {
  environment: { name: string, entry: unknown }
  isProd: boolean
}

function noop(): void {
  return
}

function runChain(utils: ChainUtils): string[] {
  const registered: string[] = []
  const chain = {
    plugin(name: string) {
      registered.push(name)
      return { use: noop }
    },
  }
  const api = {
    onAfterCreateCompiler: noop,
    onBeforeStartDevServer: noop,
    useExposed: () => ({ LynxTemplatePlugin: class {} }),
    getNormalizedConfig: () => ({ dev: { assetPrefix: '' } }),
    context: {},
    modifyBundlerChain: (
      callback: (chain: typeof chain, utils: ChainUtils) => void,
    ) => {
      callback(chain, utils)
    },
  } as unknown as Parameters<RsbuildPlugin['setup']>[0]

  void pluginLynxDebugMetadata().setup(api)
  return registered
}

const LYNX_PROD: ChainUtils = {
  environment: { name: 'lynx', entry: {} },
  isProd: true,
}

beforeEach(() => {
  vi.stubEnv('DEBUG', '')
  vi.stubEnv('CI', '')
  vi.stubEnv('CI_REPO_NAME', '')
  vi.stubEnv('BUILD_VERSION', '')
})

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('pluginLynxDebugMetadata production gate', () => {
  test('emits on a CI production build', () => {
    vi.stubEnv('CI', 'true')

    expect(runChain(LYNX_PROD)).toContain('lynx:debug-metadata')
  })

  test('emits on a release pipeline that sets BUILD_VERSION but not CI', () => {
    vi.stubEnv('BUILD_VERSION', '1.0.0.50')

    expect(runChain(LYNX_PROD)).toContain('lynx:debug-metadata')
  })

  test('emits on a pipeline that sets CI_REPO_NAME but not CI', () => {
    vi.stubEnv('CI_REPO_NAME', 'lynx-stack')

    expect(runChain(LYNX_PROD)).toContain('lynx:debug-metadata')
  })

  test('skips a local production build', () => {
    expect(runChain(LYNX_PROD)).not.toContain('lynx:debug-metadata')
  })

  test('emits on a local production build when DEBUG=rspeedy', () => {
    vi.stubEnv('DEBUG', 'rspeedy')

    expect(runChain(LYNX_PROD)).toContain('lynx:debug-metadata')
  })

  test('emits on a dev build regardless of CI (the middleware serves it)', () => {
    expect(
      runChain({ environment: { name: 'lynx', entry: {} }, isProd: false }),
    )
      .toContain('lynx:debug-metadata')
  })

  test('still skips a non-lynx environment on CI', () => {
    vi.stubEnv('CI', 'true')

    expect(runChain({ environment: { name: 'web', entry: {} }, isProd: true }))
      .not.toContain('lynx:debug-metadata')
  })
})
