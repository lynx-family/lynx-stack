// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'
import path from 'node:path'

import type { RsbuildPluginAPI } from '@rsbuild/core'

import {
  LynxEncodePlugin,
  LynxTemplatePlugin,
} from '@lynx-js/template-webpack-plugin'
import { RuntimeWrapperWebpackPlugin } from '@lynx-js/runtime-wrapper-webpack-plugin'

import { LAYERS } from './layers.js'

const PLUGIN_TEMPLATE = 'lynx:vue-template'
const PLUGIN_RUNTIME_WRAPPER = 'lynx:vue-runtime-wrapper'
const PLUGIN_ENCODE = 'lynx:vue-encode'

const DEFAULT_INTERMEDIATE = '.rspeedy'

const require = createRequire(import.meta.url)

export function applyEntry(api: RsbuildPluginAPI): void {
  api.modifyBundlerChain((chain, { environment, isProd }) => {
    const isRspeedy = api.context.callerName === 'rspeedy'
    if (!isRspeedy) return

    const isLynx =
      environment.name === 'lynx' || environment.name.startsWith('lynx-')

    const entries = chain.entryPoints.entries() ?? {}

    chain.entryPoints.clear()

    for (const [entryName, entryPoint] of Object.entries(entries)) {
      // Collect user imports from the original entry
      const imports: string[] = []
      for (const val of entryPoint.values()) {
        if (typeof val === 'string') {
          imports.push(val)
        } else if (typeof val === 'object' && val !== null && 'import' in val) {
          const imp = (val as { import?: string | string[] }).import
          if (Array.isArray(imp)) imports.push(...imp)
          else if (imp) imports.push(imp)
        }
      }

      // ----------------------------------------------------------------
      // Filenames
      // ----------------------------------------------------------------
      const intermediate = isLynx ? DEFAULT_INTERMEDIATE : ''
      const mainThreadEntry = `${entryName}__main-thread`
      const mainThreadName = path.posix.join(
        intermediate,
        `${entryName}/main-thread.js`,
      )
      const backgroundName = path.posix.join(
        intermediate,
        `${entryName}/background${isProd ? '.[contenthash:8]' : ''}.js`,
      )

      // ----------------------------------------------------------------
      // Main Thread bundle – only the PAPI bootstrap, no Vue runtime
      // ----------------------------------------------------------------
      chain
        .entry(mainThreadEntry)
        .add({
          layer: LAYERS.MAIN_THREAD,
          // The main-thread bundle contains ONLY entry-main.ts.
          // User Vue components must NOT be included here.
          import: [require.resolve('@lynx-js/vue-main-thread')],
          filename: mainThreadName,
        })
        .end()

      // ----------------------------------------------------------------
      // Background bundle – Vue runtime + user app
      // ----------------------------------------------------------------
      chain
        .entry(entryName)
        .add({
          layer: LAYERS.BACKGROUND,
          import: imports,
          filename: backgroundName,
        })
        .prepend({
          layer: LAYERS.BACKGROUND,
          import: require.resolve('@lynx-js/vue-runtime/entry-background'),
        })
        .end()

      // ----------------------------------------------------------------
      // LynxTemplatePlugin – packages both bundles into .lynx.bundle
      // ----------------------------------------------------------------
      if (isLynx) {
        const templateFilename = (
          typeof environment.config.output.filename === 'object'
            ? (environment.config.output.filename as { bundle?: string })
                .bundle
            : environment.config.output.filename
        ) ?? '[name].[platform].bundle'

        chain
          .plugin(`${PLUGIN_TEMPLATE}-${entryName}`)
          .use(LynxTemplatePlugin, [
            {
              dsl: 'react_nodiff',
              chunks: [mainThreadEntry, entryName],
              filename: templateFilename
                .replaceAll('[name]', entryName)
                .replaceAll('[platform]', environment.name),
              intermediate: path.posix.join(DEFAULT_INTERMEDIATE, entryName),
              enableCSSSelector: false,
              enableNewGesture: false,
              cssPlugins: [],
            },
          ])
          .end()
      }
    }

    // ------------------------------------------------------------------
    // RuntimeWrapperWebpackPlugin – wrap background.js, not main-thread.js
    // ------------------------------------------------------------------
    if (isLynx) {
      chain
        .plugin(PLUGIN_RUNTIME_WRAPPER)
        .use(RuntimeWrapperWebpackPlugin, [
          {
            // Exclude main-thread.js (and main-thread.[hash].js) from wrapping
            test: /^(?!.*main-thread(?:\.[A-Fa-f0-9]*)?\.js$).*\.js$/,
          },
        ])
        .end()
        .plugin(PLUGIN_ENCODE)
        .use(LynxEncodePlugin, [{}])
        .end()
    }

    // Disable IIFE wrapping – Lynx handles module scoping itself
    chain.output.set('iife', false)
  })
}
