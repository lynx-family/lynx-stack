// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { createRequire } from 'node:module'
import path from 'node:path'

import { logger } from '@rsbuild/core'
import type {
  EnvironmentContext,
  RsbuildConfig,
  RsbuildPlugin,
} from '@rsbuild/core'
import color from 'picocolors'

import { getLynxConfig } from '../config.js'
import { debug } from '../debug.js'
import { isLynx } from '../utils/is-lynx.js'
import { ProvidePlugin } from '../webpack/ProvidePlugin.js'

const DEFAULT_IPV4_SERVER_HOST = '0.0.0.0'
const DEFAULT_IPV6_SERVER_HOST = '::'

type RsbuildServerHost = NonNullable<RsbuildConfig['server']>['host']

export function pluginDev(): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:dev',
    apply(config, { action }) {
      return action === 'dev' || config.mode === 'development'
    },
    async setup(api) {
      if (
        api.context.callerName === 'rslib'
        || api.context.callerName === 'rstest'
      ) {
        return
      }
      // The dev URLs always point at the main bundle of an entry.
      function getResolveBundleName() {
        const lynxConfig = getLynxConfig(api)
        return (entry: string, platform: string): string =>
          lynxConfig.resolveBundleFilename({ entryName: entry, platform })
      }

      function appendBundleRoutes({
        routes,
        environments,
      }: {
        routes: { entryName: string, pathname: string }[]
        environments: Record<string, EnvironmentContext>
      }) {
        const resolveName = getResolveBundleName()
        for (
          const [environmentName, environmentContext] of Object.entries(
            environments,
          )
        ) {
          for (const entryName of Object.keys(environmentContext.entry)) {
            routes.push({
              entryName,
              pathname: `/${resolveName(entryName, environmentName)}`,
            })
          }
        }
      }

      // Rsbuild's getRoutes() only includes environments that produce HTML
      // files (htmlPaths). Lynx environments produce .bundle files instead,
      // so we populate dev/preview routes with the correct bundle pathnames
      // before any user plugin runs, using order: 'pre'.
      api.onAfterStartDevServer({
        handler: appendBundleRoutes,
        order: 'pre',
      })

      api.onAfterStartPreviewServer({
        handler: appendBundleRoutes,
        order: 'pre',
      })

      api.onBeforeStartDevServer(async ({ environments, server }) => {
        if (environments['web']) {
          const { createWebVirtualFilesMiddleware } = await import(
            '@lynx-js/web-rsbuild-server-middleware'
          )
          // Add the web preview middleware
          server.middlewares.use(
            createWebVirtualFilesMiddleware('/__web_preview'),
          )
        }
      })

      api.modifyRsbuildConfig({
        handler: async (config, { mergeRsbuildConfig }) => {
          const original = api.getRsbuildConfig('original')
          const originalServer = original.server
          const { bindHost, hostname } = await resolveHostname(
            config.server?.host,
            originalServer?.host,
          )

          let assetPrefix = original.dev?.assetPrefix

          switch (typeof assetPrefix) {
            case 'string': {
              if (originalServer?.port !== undefined) {
                // We should change the port of `assetPrefix` when `server.port` is set.

                const hasPortPlaceholder = assetPrefix.includes('<port>')
                if (!hasPortPlaceholder) {
                  // There is not `<port>` in `dev.assetPrefix`.
                  const assetPrefixURL = new URL(assetPrefix)

                  if (assetPrefixURL.port !== String(originalServer.port)) {
                    logger.warn(
                      `Setting different port values in ${
                        color.cyan('server.port')
                      } and ${
                        color.cyan('dev.assetPrefix')
                      }. Using server.port(${
                        color.cyan(originalServer.port)
                      }) to make HMR work.`,
                    )
                    assetPrefixURL.port = String(originalServer.port)
                    assetPrefix = assetPrefixURL.toString()
                  }
                }
              }

              break
            }
            case 'undefined':
            case 'boolean': {
              if (assetPrefix !== false) {
                // assetPrefix === true || assetPrefix === undefined
                assetPrefix = `http://${hostname}:<port>/`
              }
              break
            }
          }

          if (originalServer?.base && typeof assetPrefix === 'string') {
            if (assetPrefix.endsWith('/')) {
              assetPrefix = assetPrefix.slice(0, -1)
            }
            assetPrefix = `${assetPrefix}${originalServer.base}/`
          }

          debug(`dev.assetPrefix is normalized to ${assetPrefix}`)

          return mergeRsbuildConfig(config, {
            ...(bindHost
              ? {
                server: {
                  host: bindHost,
                },
              }
              : {}),
            dev: {
              assetPrefix,
              client: {
                // Lynx cannot use `location.hostname`.
                host: hostname,
                port: '<port>',
              },
              // A Lynx client reads the bundle from disk as often as it reads
              // it from the dev server, so the default is the opposite of
              // Rsbuild's.
              writeToDisk: original.dev?.writeToDisk ?? true,
            },
            // When using `rspeedy dev --mode production`
            // Rsbuild would use `output.assetPrefix` instead of `dev.assetPrefix`
            output: { assetPrefix },
          } as RsbuildConfig)
        },
        order: 'post',
      })

      api.modifyRsbuildConfig((config, { mergeRsbuildConfig }) => {
        const resolveName = getResolveBundleName()
        if (
          config.server?.printUrls === undefined
          || config.server?.printUrls === true
        ) {
          // A root entry is merged into every environment (the way Rsbuild
          // itself resolves entries), not replaced by an environment's own.
          const entriesByEnvironment = Object.entries(
            config.environments ?? {},
          ).map(([environmentName, environmentConfig]) =>
            [
              environmentName,
              Object.keys({
                ...config.source?.entry,
                ...environmentConfig.source?.entry,
              }),
            ] as const
          )
          return mergeRsbuildConfig(config, {
            server: {
              printUrls: (param) => {
                const finalUrls: { label: string, url: string }[] = []
                for (
                  const [environmentName, entries] of entriesByEnvironment
                ) {
                  // `dev.assetPrefix`/`dev.client.host` can be set per
                  // environment, so each environment gets its own base URL.
                  const environmentConfig = api.getNormalizedConfig({
                    environment: environmentName,
                  })
                  const assetPrefix = environmentConfig.dev.assetPrefix
                  const hostname = environmentConfig.dev.client.host
                    ?? formatHostname(environmentConfig.server.host)
                  const baseForUrls = (
                    typeof assetPrefix === 'string'
                      ? assetPrefix
                      : `http://${hostname}:<port>/`
                  ).replaceAll('<port>', String(param.port))
                  for (const entry of entries) {
                    const pathname = resolveName(entry, environmentName)
                    finalUrls.push({
                      label: environmentName,
                      url: new URL(pathname, baseForUrls).toString(),
                    })
                    if (environmentName === 'web') {
                      finalUrls.push({
                        label: `∟ Preview`,
                        url: new URL(
                          `/__web_preview?casename=${
                            encodeURIComponent(pathname)
                          }`,
                          baseForUrls,
                        ).toString(),
                      })
                    }
                  }
                }
                return finalUrls.map((urlInfo) => {
                  // capitalize the first letter of label
                  const label = urlInfo.label.charAt(0).toUpperCase()
                    + urlInfo.label.slice(1)
                  urlInfo.label = label
                  return urlInfo
                })
              },
            },
          })
        }
        return config
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
        const pluginDir = path.dirname(
          require.resolve('@lynx-js/rsbuild-plugin/package.json'),
        )
        // The upstream `@rspack/core/hot/dev-server` recovers from a failed
        // `apply` with `window.location.reload()`, which Lynx does not have.
        // This replacement reloads through the DevTool instead.
        const hotDevServerPath = require.resolve(
          '@lynx-js/webpack-dev-transport/hotDevServer',
        )
        const hostname = environment.config.dev?.client?.host ?? ''

        const searchParams = new URLSearchParams({
          hostname,
          port: api.context.devServer?.port?.toString() ?? '',
          pathname: '/rsbuild-hmr',
          hot: (environment.config.dev?.hmr ?? true) ? 'true' : 'false',
          'live-reload': (environment.config.dev?.liveReload ?? true)
            ? 'true'
            : 'false',
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
                '@lynx-js/webpack-dev-transport/client',
                `${require.resolve('@lynx-js/webpack-dev-transport/client')}?${searchParams.toString()}`
              )
              .set(
                '@rspack/core/hot/emitter.js',
                require.resolve('@rspack/core/hot/emitter.js', {
                  paths: [rsbuildPath],
                })
              )
              .set(
                '@rspack/core/hot/log.js',
                require.resolve('@rspack/core/hot/log', {
                  paths: [rsbuildPath],
                })
              )
              .set(
                '@rspack/core/hot/log-apply-result.js',
                require.resolve('@rspack/core/hot/log-apply-result', {
                  paths: [rsbuildPath],
                })
              )
              .set('@rspack/core/hot/dev-server', hotDevServerPath)
            .end()
          .end()
          .plugin('lynx.hmr.provide.dev_server_client')
            .use(ProvidePlugin, [
              {
                __webpack_dev_server_client__: [
                  require.resolve(
                    './client/hmr/WebSocketClient.js',
                    {
                      paths: [pluginDir],
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
              WebSocket: [require.resolve('@lynx-js/websocket'), 'default'],
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
): Promise<string | undefined> {
  // Use the `default` export (the live CJS exports object) instead of the
  // namespace: builtin namespaces snapshot named exports, which breaks
  // `spyOn(os, 'networkInterfaces')` in tests.
  const [
    { default: ipaddr },
    { default: os },
  ] = await Promise.all([
    import('ipaddr.js'),
    import('node:os'),
  ])

  let host: string | undefined

  const networks = Object.entries(os.networkInterfaces())
    .flatMap(([name, networks]) => {
      return (networks ?? []).map((network) => ({
        name,
        network,
      }))
    })
    .filter(({ network }) => {
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

      return true
    })
    .sort((left, right) => {
      return getNetworkPriority(left.name, left.network.address)
        - getNetworkPriority(right.name, right.network.address)
    })

  if (networks.length > 0) {
    host = networks[0]!.network.address

    if (host.includes(':')) {
      host = `[${host}]`
    }
  }

  return host
}

async function resolveHostname(
  host: RsbuildServerHost | undefined,
  originalHost: RsbuildServerHost | undefined,
): Promise<{ bindHost?: string, hostname: string }> {
  const hostname = formatHostname(host)
  if (originalHost !== undefined || hostname !== DEFAULT_IPV4_SERVER_HOST) {
    return { hostname }
  }

  const ipv4Hostname = await findIp('v4')
  if (ipv4Hostname) {
    return {
      bindHost: DEFAULT_IPV4_SERVER_HOST,
      hostname: ipv4Hostname,
    }
  }

  const ipv6Hostname = await findIp('v6')
  if (ipv6Hostname) {
    return {
      bindHost: DEFAULT_IPV6_SERVER_HOST,
      hostname: ipv6Hostname,
    }
  }

  // Prefer an IPv4 loopback for client-facing URLs over the wildcard bind host.
  return { hostname: await findIp('v4', true) ?? hostname }
}

function formatHostname(host: RsbuildServerHost | undefined): string {
  if (host === true || host === undefined) {
    return DEFAULT_IPV4_SERVER_HOST
  }
  if (host === false) {
    return 'localhost'
  }
  if (host.includes(':') && !host.startsWith('[')) {
    return `[${host}]`
  }
  return host
}

function getNetworkPriority(name: string, address: string): number {
  const normalizedName = name.toLowerCase()

  if (isPreferredInterface(normalizedName) && !isLinkLocalIpv4(address)) {
    return 0
  }

  if (!isVirtualInterface(normalizedName) && !isLinkLocalIpv4(address)) {
    return 1
  }

  if (!isVirtualInterface(normalizedName)) {
    return 2
  }

  return 3
}

function isPreferredInterface(name: string): boolean {
  return /^(?:en\d+|eth\d+|eno\d+|enp\w+|wl\w+)$/.test(name)
}

function isVirtualInterface(name: string): boolean {
  return [
    'utun',
    'tun',
    'tap',
    'awdl',
    'llw',
    'lo',
  ].some((prefix) => name.startsWith(prefix))
}

function isLinkLocalIpv4(address: string): boolean {
  return address.startsWith('169.254.')
}
