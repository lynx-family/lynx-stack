// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'
import path from 'node:path'

import { logger } from '@rsbuild/core'
import type { RsbuildConfig, RsbuildPlugin } from '@rsbuild/core'
import color from 'picocolors'

import type { Dev } from '../config/dev/index.js'
import type { Server } from '../config/server/index.js'
import { debug } from '../debug.js'
import { isLynx } from '../utils/is-lynx.js'
import { ProvidePlugin } from '../webpack/ProvidePlugin.js'

export function pluginDev(
  options?: Dev,
  server?: Server,
): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:dev',
    apply(config, { action }) {
      return action === 'dev' || config.mode === 'development'
    },
    async setup(api) {
      const hostname = server?.host ?? await findIp('v4')

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

      if (server?.base) {
        if ((assetPrefix as string).endsWith('/')) {
          assetPrefix = (assetPrefix as string).slice(0, -1)
        }
        assetPrefix = `${assetPrefix}${server.base}/`
      }

      debug(`dev.assetPrefix is normalized to ${assetPrefix}`)

      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        return mergeRsbuildConfig(config, {
          dev: {
            assetPrefix,
            client: {
              // Lynx cannot use `location.hostname`.
              host: hostname,
              port: '<port>',
            },
          },
          // When using `rspeedy dev --mode production`
          // Rsbuild would use `output.assetPrefix` instead of `dev.assetPrefix`
          output: { assetPrefix },
        } as RsbuildConfig)
      })

      const require = createRequire(import.meta.url)

      api.modifyBundlerChain((chain, { isDev, environment }) => {
        // We should modify public path in 3 cases:
        //   1. `rspeedy dev`
        //   2. `rspeedy dev --mode=production`
        //   3. `rspeedy build --mode=development`
        const { action } = api.context
        if (action !== 'dev' && !isDev) {
          return
        }
        const rsbuildPath = require.resolve('@rsbuild/core')
        const rspeedyDir = path.dirname(
          require.resolve('@lynx-js/rspeedy/package.json'),
        )

        const searchParams = new URLSearchParams({
          hostname,
          port: api.context.devServer?.port?.toString() ?? '',
          pathname: '/rsbuild-hmr',
          hot: (options?.hmr ?? true) ? 'true' : 'false',
          'live-reload': (options?.liveReload ?? true) ? 'true' : 'false',
          protocol: 'ws',
        })

        // Only add token if it's defined
        if (environment.webSocketToken) {
          searchParams.set('token', environment.webSocketToken)
        }

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
                `${require.resolve('@lynx-js/webpack-dev-transport/client')}?${searchParams.toString()}`
              )
              .set(
                '@rspack/core/hot/dev-server',
                require.resolve('@rspack/core/hot/dev-server', {
                  paths: [rsbuildPath],
                })
              )
            .end()
          .end()
          .plugin('lynx.hmr.provide.dev_server_client')
            .use(ProvidePlugin, [
              {
                __webpack_dev_server_client__: [
                  require.resolve(
                    './client/hmr/WebSocketClient.js',
                    {
                      paths: [rspeedyDir],
                    },
                  ),
                  'default'
                ],
              }
            ])
          .end()
        if (isLynx(environment)) {
          chain.plugin('lynx.hmr.provide.websocket')
            .use(ProvidePlugin, [{
              WebSocket: [
                options?.client?.websocketTransport
                  ?? require.resolve('@lynx-js/websocket'),
                'default',
              ],
            }])
            .end()
        }
      })
    },
  }
}

export async function findIp(
  family: 'v4' | 'v6',
  isInternal = false,
): Promise<string> {
  const [
    { default: ipaddr },
    os,
  ] = await Promise.all([
    import('ipaddr.js'),
    import('node:os'),
  ])

  let host: string | undefined

  const networks = Object.values(os.networkInterfaces())
    .flatMap((networks) => networks ?? [])
    .filter((network) => {
      if (!network || !network.address) {
        return false
      }

      if (network.family !== `IP${family}`) {
        return false
      }

      if (network.internal !== isInternal) {
        return false
      }

      if (family === 'v6') {
        const range = ipaddr.parse(network.address).range()

        if (range !== 'ipv4Mapped' && range !== 'uniqueLocal') {
          return false
        }
      }

      return network.address
    })

  if (networks.length > 0) {
    // Take the first network found
    // See: https://github.com/webpack/webpack-dev-server/pull/5411/
    host = networks[0]!.address

    if (host.includes(':')) {
      host = `[${host}]`
    }
  }

  if (!host) {
    throw new Error(`No valid IP found`)
  }

  return host
}
