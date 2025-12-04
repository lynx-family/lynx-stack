// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { createRequire } from 'node:module'
import path from 'node:path'

import type { RsbuildPlugin } from '@rsbuild/core'
import gte from 'semver/functions/gte.js'

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
      const require = createRequire(import.meta.url)

      const reactLynxPkg = require.resolve('@lynx-js/react/package.json', {
        paths: [rootPath ?? api.context.rootPath],
      })
      const { version } = require(reactLynxPkg) as { version: string }

      const reactLynxDir = path.dirname(reactLynxPkg)

      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        return mergeRsbuildConfig(config, {
          source: {
            include: [reactLynxDir],
          },
        })
      })

      api.modifyBundlerChain(async (chain, { isProd, environment, rspack }) => {
        if (Object.hasOwn(environment, S_PLUGIN_REACT_ALIAS)) {
          // This environment has already been processed
          return
        }
        const resolve = createLazyResolver(
          rspack,
          rootPath ?? api.context.rootPath,
          lazy ? ['lazy', 'import'] : ['import'],
        )
        const resolvePreact = createLazyResolver(rspack, reactLynxDir, [
          'import',
        ])
        api.expose(Symbol.for('@lynx-js/react/internal:resolve'), {
          resolve,
        })

        Object.defineProperty(environment, S_PLUGIN_REACT_ALIAS, {
          value: true,
        })
        const [
          jsxRuntimeBackground,
          jsxRuntimeMainThread,
          jsxDevRuntimeBackground,
          jsxDevRuntimeMainThread,
          reactLepusBackground,
          reactLepusMainThread,
          reactCompat,
        ] = await Promise.all([
          resolve('@lynx-js/react/jsx-runtime'),
          resolve('@lynx-js/react/lepus/jsx-runtime'),
          resolve('@lynx-js/react/jsx-dev-runtime'),
          resolve('@lynx-js/react/lepus/jsx-dev-runtime'),
          resolve('@lynx-js/react'),
          resolve('@lynx-js/react/lepus'),
          gte(version, '0.111.9999')
            ? resolve('@lynx-js/react/compat')
            : Promise.resolve(null),
        ])

        const jsxRuntime = {
          background: jsxRuntimeBackground,
          mainThread: jsxRuntimeMainThread,
        }
        const jsxDevRuntime = {
          background: jsxDevRuntimeBackground,
          mainThread: jsxDevRuntimeMainThread,
        }
        const reactLepus = {
          background: reactLepusBackground,
          mainThread: reactLepusMainThread,
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
          // TODO: add `debug` after bump peerDependencies['@lynx-js/react'] to 0.111.1
          // 'debug',
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

        if (isProd) {
          chain.resolve.alias.set('@lynx-js/react/debug$', false)
          chain.resolve.alias.set('@lynx-js/preact-devtools$', false)
        }

        if (!chain.resolve.alias.has('react$')) {
          chain.resolve.alias.set(
            'react$',
            reactLepus.background,
          )
        }

        chain
          .resolve
          .alias
          .set(
            '@lynx-js/react$',
            reactLepus.background,
          )

        if (reactCompat) {
          chain
            .resolve
            .alias
            .set(
              '@lynx-js/react/compat$',
              reactCompat,
            )
        }

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
            resolvePreact(entry).then(value => {
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

export function createLazyResolver(
  rspack: typeof import('@rspack/core').rspack,
  directory: string,
  conditionNames: string[],
) {
  const { ResolverFactory } = rspack.experiments.resolver
  let lazyExports: Record<string, string>
  let resolverLazy: (
    directory: string,
    request: string,
  ) => { error?: string, path?: string }

  return async (
    request: string,
  ): Promise<string> => {
    if (!lazyExports) {
      lazyExports = {}
    }

    if (lazyExports[request] === undefined) {
      if (!resolverLazy) {
        const resolver = new ResolverFactory({
          conditionNames,
          enablePnp: true,
        })
        resolverLazy = (dir: string, req: string) => resolver.sync(dir, req)
      }
      const resolveResult = resolverLazy(directory, request)
      if (resolveResult.error) {
        throw new Error(resolveResult.error)
      }
      if (!resolveResult.path) {
        throw new Error(`Failed to resolve ${request}`)
      }
      lazyExports[request] = resolveResult.path
    }

    return lazyExports[request]
  }
}
