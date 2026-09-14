// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI } from '@rsbuild/core'
import { expect, test, vi } from 'vitest'

import { pluginLynxDebugMetadata } from '../src/pluginLynxDebugMetadata.js'

test('applies once when registered more than once', async () => {
  const exposed = new Map<string | symbol, unknown>()
  const api = {
    expose: (id: string | symbol, value: unknown) => exposed.set(id, value),
    useExposed: (id: string | symbol) => exposed.get(id),
    onAfterCreateCompiler: vi.fn(),
    modifyBundlerChain: vi.fn(),
    onBeforeStartDevServer: vi.fn(),
  }

  for (const plugin of [pluginLynxDebugMetadata(), pluginLynxDebugMetadata()]) {
    await plugin.setup(api as unknown as RsbuildPluginAPI)
  }

  expect(api.onAfterCreateCompiler).toHaveBeenCalledTimes(1)
  expect(api.modifyBundlerChain).toHaveBeenCalledTimes(1)
  expect(api.onBeforeStartDevServer).toHaveBeenCalledTimes(1)
})
