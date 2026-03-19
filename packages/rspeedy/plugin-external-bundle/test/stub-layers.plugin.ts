// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPlugin } from '@rsbuild/core'

interface ExposedLayers {
  readonly BACKGROUND: string
  readonly MAIN_THREAD: string
}

/**
 * Stub plugin that exposes LAYERS for testing
 */
export const pluginStubLayers = (
  layers: ExposedLayers = {
    BACKGROUND: 'BACKGROUND_LAYER',
    MAIN_THREAD: 'MAIN_THREAD_LAYER',
  },
): RsbuildPlugin => ({
  name: 'lynx:stub-layers',
  setup(api) {
    api.expose<ExposedLayers>(Symbol.for('LAYERS'), layers)
  },
})
