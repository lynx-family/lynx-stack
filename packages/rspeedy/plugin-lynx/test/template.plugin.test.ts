// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'
import type { RsbuildPluginAPI } from '@rsbuild/core'
import { describe, expect, test } from '@rstest/core'

import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'
import {
  LynxEncodePlugin,
  WebEncodePlugin,
} from '@lynx-js/template-webpack-plugin'
import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { pluginLynx } from '../src/index.js'

interface LynxTemplatePluginExposure {
  LynxTemplatePlugin: Pick<
    typeof LynxTemplatePlugin,
    'getLynxTemplatePluginHooks'
  >
}

describe('pluginTemplate', () => {
  test('exposes the template plugins without a DSL plugin', async () => {
    let exposedTemplate: LynxTemplatePluginExposure | undefined
    let exposedEncode: { LynxEncodePlugin: unknown } | undefined
    let exposedWebEncode: { WebEncodePlugin: unknown } | undefined
    let exposedRuntimeWrapper:
      | { RuntimeWrapperWebpackPlugin: unknown }
      | undefined

    const rsbuild = await createRsbuild({
      cwd: path.dirname(fileURLToPath(import.meta.url)),
      rsbuildConfig: {
        environments: { lynx: {} },
        plugins: [
          ...pluginLynx(),
          {
            name: 'test:capture',
            setup(api: RsbuildPluginAPI) {
              api.modifyBundlerChain(() => {
                exposedTemplate = api.useExposed<LynxTemplatePluginExposure>(
                  Symbol.for('LynxTemplatePlugin'),
                )
                exposedEncode = api.useExposed(Symbol.for('LynxEncodePlugin'))
                exposedWebEncode = api.useExposed(Symbol.for('WebEncodePlugin'))
                exposedRuntimeWrapper = api.useExposed(
                  Symbol.for('RuntimeWrapperWebpackPlugin'),
                )
              })
            },
          },
        ],
      },
    })

    await rsbuild.initConfigs()

    expect(
      typeof exposedTemplate?.LynxTemplatePlugin.getLynxTemplatePluginHooks,
    )
      .toBe('function')
    expect(exposedEncode?.LynxEncodePlugin).toBe(LynxEncodePlugin)
    expect(exposedWebEncode?.WebEncodePlugin).toBe(WebEncodePlugin)
    expect(exposedRuntimeWrapper?.RuntimeWrapperWebpackPlugin).toBe(
      RuntimeWrapperWebpackPlugin,
    )
  })
})
