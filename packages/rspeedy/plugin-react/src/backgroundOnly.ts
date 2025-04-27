// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPluginAPI } from '@rsbuild/core'

import { createLazyResolver } from '@lynx-js/react-alias-rsbuild-plugin'
import { LAYERS } from '@lynx-js/react-webpack-plugin'

const DETECT_IMPORT_ERROR = 'react:detect-import-error'
const ALIAS_BACKGROUND_ONLY_MAIN = 'react:alias-background-only-main'
const ALIAS_BACKGROUND_ONLY_BACKGROUND =
  'react:alias-background-only-background'

export function applyBackgroundOnly(
  api: RsbuildPluginAPI,
): void {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))

  const backgroundResolve = createLazyResolver(
    __dirname,
    ['import'],
  )
  const mainThreadResolve = createLazyResolver(
    __dirname,
    ['lepus'],
  )

  api.modifyBundlerChain(async chain => {
    const backgroundOnly = {
      background: await backgroundResolve('background-only'),
      mainThread: await mainThreadResolve('background-only'),
    }

    chain
      .module
      .rule(ALIAS_BACKGROUND_ONLY_MAIN)
      .issuerLayer(LAYERS.MAIN_THREAD)
      .resolve
      .alias
      .set(
        'background-only$',
        backgroundOnly.mainThread,
      )

    chain
      .module
      .rule(ALIAS_BACKGROUND_ONLY_BACKGROUND)
      .issuerLayer(LAYERS.BACKGROUND)
      .resolve
      .alias
      .set(
        'background-only$',
        backgroundOnly.background,
      )

    chain
      .module
      .rule(DETECT_IMPORT_ERROR)
      .test(backgroundOnly.mainThread)
      .issuerLayer(LAYERS.MAIN_THREAD)
      .use(DETECT_IMPORT_ERROR)
      .loader(path.resolve(__dirname, 'loaders/invalid-import-error-loader'))
      .options({
        message:
          '\'background-only\' cannot be imported from a main-thread module.',
      })
  })
}
