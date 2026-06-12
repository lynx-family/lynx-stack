// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { LAYERS } from '@lynx-js/react-webpack-plugin'

// `node:module` is a Node builtin (kept external by rstest), so its
// `createRequire` cannot be intercepted by `rstest.mock`; mock the `semver`
// comparison the plugin feeds the resolved version into instead.
rstest.mock('semver/functions/gte.js', () => {
  const original = rstest.requireActual<
    | ((version: string, range: string) => boolean)
    | { default: (version: string, range: string) => boolean }
  >('semver/functions/gte.js')
  const gte = 'default' in original ? original.default : original
  return {
    default: rstest.fn((_version: string, range: string) =>
      gte('0.111.999-canary-20250728-1f7b2d07', range)
    ),
  }
})

describe('@lynx-js/react/compat - alias', () => {
  test('alias with @lynx-js/react@0.111.999-canary-20250728-1f7b2d07', async () => {
    rstest.stubEnv('NODE_ENV', 'production')

    const { pluginReactAlias } = await import('../../src/index.js')

    const rsbuild = await createRsbuild({
      rsbuildConfig: {
        plugins: [
          pluginReactAlias({
            LAYERS,
          }),
        ],
      },
      cwd: path.dirname(fileURLToPath(import.meta.url)),
    })
    const [config] = await rsbuild.initConfigs()
    expect(config?.resolve?.alias ?? {}).not.toHaveProperty(
      '@lynx-js/react/compat$',
    )

    // The mock substitutes the version fed into the comparison, so assert
    // the plugin still resolved and forwarded the REAL installed version —
    // this keeps the resolve-version-then-compare flow covered.
    const require = createRequire(import.meta.url)
    const reactLynxPkg = require.resolve('@lynx-js/react/package.json', {
      paths: [path.dirname(fileURLToPath(import.meta.url))],
    })
    const { version: realVersion } = require(reactLynxPkg) as {
      version: string
    }
    const gteModule = await import('semver/functions/gte.js')
    const gteMock = rstest.mocked(gteModule.default)
    expect(gteMock).toHaveBeenCalledWith(realVersion, '0.111.9999')
  })
})
