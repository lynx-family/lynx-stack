// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'

import { logger } from '@rsbuild/core'
import type { RsbuildConfig, RsbuildPlugin } from '@rsbuild/core'
import color from 'picocolors'

import type { Dev } from '../config/dev/index.js'
import type { Server } from '../config/server/index.js'
import { debug } from '../debug.js'
import { getIp } from '../utils/getIp.js'
import { CompilationIdPlugin } from '../webpack/CompilationIdPlugin.js'
import { ProvidePlugin } from '../webpack/ProvidePlugin.js'

export function pluginDev(
  options?: Dev,
  server?: Server,
): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:dev',
    setup(api) {
      const hostname = server?.host ?? getIp()

      let assetPrefix = options?.assetPrefix

      switch (typeof assetPrefix) {
        case 'string': {
          if (server?.port !== undefined) {
            // We should change the port of `assetPrefix` when `server.port` is set.

            const hasPortPlaceholder = assetPrefix.includes('<port>')
            if (!hasPortPlaceholder) {
              // There is not `<port>` in `dev.assetPrefix`.
              const assetPrefixURL = new URL(assetPrefix)

              if (assetPrefixURL.port !== String(server.port)) {
                logger.warn(
                  `Setting different port values in ${
                    color.cyan('server.port')
                  } and ${color.cyan('dev.assetPrefix')}. Using server.port(${
                    color.cyan(server.port)
                  }) to make HMR work.`,
                )
                assetPrefixURL.port = String(server.port)
                assetPrefix = assetPrefixURL.toString()
              }
            }
          }

          break
        }
        case 'undefined':
        case 'boolean': {
          if (options?.assetPrefix !== false) {
            // assetPrefix === true || assetPrefix === undefined
            assetPrefix = `http://${hostname}:<port>/`
          }
          break
        }
      }

      debug(`dev.assetPrefix is normalized to ${assetPrefix}`)

      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        return mergeRsbuildConfig(config, {
          dev: {
            assetPrefix,
            client: {
              // Lynx cannot use `location.hostname`.
              host: hostname,
            },
          },
        } as RsbuildConfig)
      })

      const require = createRequire(import.meta.url)

      api.modifyBundlerChain((chain, { isProd }) => {
        if (isProd) {
          return
        }
        const rsbuildPath = require.resolve('@rsbuild/core')
        // dprint-ignore
        chain
          .resolve
            .alias
              .set(
                'webpack/hot/log.js',
                require.resolve('@rspack/core/hot/log', {
                  paths: [rsbuildPath],
                })
              )
              .set(
                'webpack/hot/emitter.js',
                require.resolve('@rspack/core/hot/emitter', {
                  paths: [rsbuildPath],
                }),
              )
              .set(
                '@lynx-js/webpack-dev-transport/client',
                `${require.resolve('@lynx-js/webpack-dev-transport/client')}?hostname=${
                  hostname
                }&port=${
                  api.context.devServer?.port
                }&pathname=/rsbuild-hmr&hot=true&live-reload=true&protocol=ws`
              )
              .set(
                '@rspack/core/hot/dev-server',
                require.resolve('@rspack/core/hot/dev-server', {
                  paths: [rsbuildPath],
                })
              )
            .end()
          .end()
          .plugin('lynx.hmr.provide')
            .use(ProvidePlugin, [
              {
                WebSocket: [
                  options?.client?.websocketTransport ?? require.resolve('@lynx-js/websocket'),
                  'default',
                ],
                __webpack_dev_server_client__: [require.resolve('../../client/hmr/WebSocketClient.js'), 'default'],
              }
            ])
          .end()
          .plugin('lynx.hmr.compilation-id')
            .use(CompilationIdPlugin, [])
          .end()
      })
    },
  }
}
