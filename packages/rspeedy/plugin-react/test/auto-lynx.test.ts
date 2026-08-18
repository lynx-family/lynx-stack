// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { pluginReactLynx } from '../src/index.js'

describe('pluginAutoLynx', () => {
  test('applies the Lynx build engine with plain Rsbuild', async () => {
    const rsbuild = await createRsbuild({
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rsbuildConfig: {
        environments: { lynx: {} },
        source: { entry: { main: './fixtures/basic.tsx' } },
        plugins: [pluginReactLynx()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    expect(
      config?.plugins?.some(plugin =>
        plugin?.constructor.name === 'LynxTemplatePlugin'
      ),
    ).toBe(true)
  })
})
