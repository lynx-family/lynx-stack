// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRsbuild } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { pluginLynx } from '@lynx-js/rsbuild-plugin'

import { pluginReactLynx } from '../src/index.js'

function swcInclude(config: unknown): string[] {
  const found = /"include":\[[^\]]*"transform-[^\]]*\]/.exec(
    JSON.stringify(config),
  )
  return found
    ? (JSON.parse(`{${found[0].replace('"include"', '"i"')}}`) as {
      i: string[]
    }).i
    : []
}

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

  test('does not apply the engine again when it is already there', async () => {
    const rsbuild = await createRsbuild({
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rsbuildConfig: {
        mode: 'production',
        environments: { lynx: {} },
        source: { entry: { main: './fixtures/basic.tsx' } },
        plugins: [...pluginLynx(), pluginReactLynx()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    // Applying the engine twice concatenates the list instead of replacing it.
    const include = swcInclude(config)
    expect(include).toStrictEqual([...new Set(include)])
  })

  test('does not apply the engine again when it is registered per environment', async () => {
    const rsbuild = await createRsbuild({
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rsbuildConfig: {
        mode: 'production',
        environments: { lynx: { plugins: [...pluginLynx()] } },
        source: { entry: { main: './fixtures/basic.tsx' } },
        plugins: [pluginReactLynx()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const include = swcInclude(config)
    expect(include).toStrictEqual([...new Set(include)])
  })

  test('does not apply the engine again when it is applied after it', async () => {
    const rsbuild = await createRsbuild({
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rsbuildConfig: {
        mode: 'production',
        environments: { lynx: {} },
        source: { entry: { main: './fixtures/basic.tsx' } },
        plugins: [pluginReactLynx(), ...pluginLynx()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    const include = swcInclude(config)
    expect(include).toStrictEqual([...new Set(include)])
  })

  test('applies the engine once for each environment that has the DSL plugin', async () => {
    const rsbuild = await createRsbuild({
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rsbuildConfig: {
        environments: {
          lynx: { plugins: [pluginReactLynx()] },
          web: { plugins: [pluginReactLynx()] },
        },
        source: { entry: { main: './fixtures/basic.tsx' } },
      },
    })

    const configs = await rsbuild.initConfigs()

    expect(configs).toHaveLength(2)
    for (const config of configs) {
      const include = swcInclude(config)
      expect(include).not.toHaveLength(0)
      expect(include).toStrictEqual([...new Set(include)])
    }
  })

  test('applies the engine for an environment that does not register it', async () => {
    const rsbuild = await createRsbuild({
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rsbuildConfig: {
        environments: {
          lynx: { plugins: [...pluginLynx(), pluginReactLynx()] },
          web: { plugins: [pluginReactLynx()] },
        },
        source: { entry: { main: './fixtures/basic.tsx' } },
      },
    })

    const configs = await rsbuild.initConfigs()

    expect(configs).toHaveLength(2)
    for (const config of configs) {
      const include = swcInclude(config)
      expect(include).not.toHaveLength(0)
      expect(include).toStrictEqual([...new Set(include)])
    }
  })

  test('does not repeat the engine when every environment registers it', async () => {
    const rsbuild = await createRsbuild({
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rsbuildConfig: {
        environments: {
          lynx: { plugins: [...pluginLynx(), pluginReactLynx()] },
          web: { plugins: [...pluginLynx(), pluginReactLynx()] },
        },
        source: { entry: { main: './fixtures/basic.tsx' } },
      },
    })

    const configs = await rsbuild.initConfigs()

    expect(configs).toHaveLength(2)
    for (const config of configs) {
      const include = swcInclude(config)
      expect(include).not.toHaveLength(0)
      expect(include).toStrictEqual([...new Set(include)])
    }
  })

  test('does not apply the engine for the rslib caller', async () => {
    const rsbuild = await createRsbuild({
      callerName: 'rslib',
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rsbuildConfig: {
        mode: 'production',
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
    ).toBe(false)
  })

  test('honors the apply condition of the engine plugins', async () => {
    const rsbuild = await createRsbuild({
      // eslint-disable-next-line n/no-unsupported-features/node-builtins
      cwd: import.meta.dirname,
      rsbuildConfig: {
        mode: 'production',
        environments: { lynx: {} },
        source: { entry: { main: './fixtures/basic.tsx' } },
        plugins: [pluginReactLynx()],
      },
    })

    const [config] = await rsbuild.initConfigs()

    // `pluginDev` is gated on `apply`, so a production build has no HMR alias.
    expect(config?.resolve?.alias).not.toHaveProperty(
      '@lynx-js/webpack-dev-transport/client',
    )
  })
})
