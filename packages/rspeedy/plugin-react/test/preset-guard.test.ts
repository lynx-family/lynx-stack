// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import { expect, test } from '@rstest/core'

// When `pluginReactLynx()` runs on a plain Rsbuild build (not the Rspeedy CLI,
// not rslib/rstest) without `pluginLynxPreset()`, the Lynx build engine is
// never applied. The plugin must fail fast with an actionable error instead of
// silently emitting a broken bundle.
test('pluginReactLynx() fails fast when pluginLynxPreset() is missing', async () => {
  const { pluginReactLynx } = await import('../src/index.js')

  const rsbuild = await createRsbuild({
    cwd: path.dirname(fileURLToPath(import.meta.url)),
    rsbuildConfig: {
      plugins: [pluginReactLynx()],
      environments: { lynx: {} },
    },
  })

  await expect(rsbuild.initConfigs()).rejects.toThrow(
    /`pluginReactLynx\(\)` requires `pluginLynxPreset\(\)`/,
  )
})
