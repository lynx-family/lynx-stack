// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'

import type { RsbuildPlugin } from '@rsbuild/core'
import type { ResolveFunction } from 'enhanced-resolve'

export interface Options {
  lazy?: boolean | undefined

  LAYERS: {
    MAIN_THREAD: string
    BACKGROUND: string
  }

  rootPath?: string | undefined
}

const S_PLUGIN_REACT_ALIAS = Symbol.for('@lynx-js/plugin-react-alias')

export function pluginReactAlias(options: Options): RsbuildPlugin {
  const { LAYERS, lazy, rootPath } = options ?? {}

  return {
    name: 'lynx:react-alias',
    setup(api) {
      const hasAlias = api.useExposed<boolean>(S_PLUGIN_REACT_ALIAS)
      if (hasAlias) {
        // We make sure that only make aliased once
        return
      }
      api.expose(S_PLUGIN_REACT_ALIAS, true)

      const require = createRequire(import.meta.url)

      const reactLynxDir = path.dirname(
        require.resolve('@lynx-js/react/package.json', {
          paths: [rootPath ?? api.context.rootPath],
        }),
      )
      const resolve = createLazyResolver(
        reactLynxDir,
        lazy ? ['lazy', 'import'] : ['import'],
      )

      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        return mergeRsbuildConfig(config, {
          source: {
            include: [reactLynxDir],
          },
        })
      })

      api.modifyBundlerChain(async chain => {
        // FIXME(colinaaa): use `Promise.all`
        const jsxRuntime = {
          background: await resolve('@lynx-js/react/jsx-runtime'),
          mainThread: await resolve('@lynx-js/react/lepus/jsx-runtime'),
        }
        const jsxDevRuntime = {
          background: await resolve('@lynx-js/react/jsx-dev-runtime'),
          mainThread: await resolve('@lynx-js/react/lepus/jsx-dev-runtime'),
        }
        const reactLepus = {
          background: await resolve('@lynx-js/react'),
          mainThread: await resolve('@lynx-js/react/lepus'),
        }

        // dprint-ignore
        chain
          .module
            .rule('react:jsx-runtime:main-thread')
              .issuerLayer(LAYERS.MAIN_THREAD)
              .resolve
                .alias
                  .set('react/jsx-runtime', jsxRuntime.mainThread)
                  .set('react/jsx-dev-runtime', jsxDevRuntime.mainThread)
                  .set('@lynx-js/react/jsx-runtime', jsxRuntime.mainThread)
                  .set('@lynx-js/react/jsx-dev-runtime', jsxDevRuntime.mainThread)
                  .set('@lynx-js/react/lepus$', reactLepus.mainThread)
                  .set('@lynx-js/react/lepus/jsx-runtime', jsxRuntime.mainThread)
                  .set('@lynx-js/react/lepus/jsx-dev-runtime', jsxDevRuntime.mainThread)
                .end()
              .end()
            .end()
            .rule('react:jsx-runtime:background')
            .issuerLayer(LAYERS.BACKGROUND)
              .resolve
                .alias
                  .set('react/jsx-runtime', jsxRuntime.background)
                  .set('react/jsx-dev-runtime', jsxDevRuntime.background)
                  .set('@lynx-js/react/jsx-runtime', jsxRuntime.background)
                  .set('@lynx-js/react/jsx-dev-runtime', jsxDevRuntime.background)
                  .set('@lynx-js/react/lepus$', reactLepus.background)
                .end()
              .end()
            .end()
          .end()

        // react-transform may add imports of the following entries
        // We need to add aliases for that
        const transformedEntries = [
          'experimental/lazy/import',
          'internal',
          'legacy-react-runtime',
          'runtime-components',
          'worklet-runtime/bindings',
        ]

        await Promise.all(
          transformedEntries
            .map(entry => `@lynx-js/react/${entry}`)
            .map(entry =>
              resolve(entry).then(value => {
                chain
                  .resolve
                  .alias
                  .set(`${entry}$`, value)
              })
            ),
        )

        chain
          .resolve
          .alias
          .set(
            'react$',
            reactLepus.background,
          )
          .set(
            '@lynx-js/react$',
            reactLepus.background,
          )

        const preactEntries = [
          'preact',
          'preact/compat',
          'preact/debug',
          'preact/devtools',
          'preact/hooks',
          'preact/test-utils',
          'preact/jsx-runtime',
          'preact/jsx-dev-runtime',
          'preact/compat',
          'preact/compat/client',
          'preact/compat/server',
          'preact/compat/jsx-runtime',
          'preact/compat/jsx-dev-runtime',
          'preact/compat/scheduler',
        ]
        await Promise.all(
          preactEntries.map(entry =>
            resolve(entry).then(value => {
              chain
                .resolve
                .alias
                .set(`${entry}$`, value)
            })
          ),
        )
      })
    },
  }
}

export function createLazyResolver(context: string, conditionNames: string[]) {
  let lazyExports: Record<string, string | false>
  let resolverLazy: ResolveFunction

  return async (
    request: string,
  ): Promise<string> => {
    const { default: resolver } = await import('enhanced-resolve')

    return (
      (lazyExports ??= {})[request] ??=
        (resolverLazy ??= resolver.create.sync({ conditionNames }))(
          context,
          request,
        )
    ) as string
  }
}
