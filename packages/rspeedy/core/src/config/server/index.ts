// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { CompressOptions, ProxyConfig, ServerConfig } from '@rsbuild/core'

/**
 * {@inheritdoc Config.server}
 * @public
 */
export interface Server {
  /**
   * Configure the base path of the server.
   *
   * @remarks
   * By default, the base path of the server is `/`, and users can access lynx bundle through `http://<host>:<port>/main.lynx.bundle`
   *
   * If you want to access lynx bundle through `http://<host>:<port>/foo/main.lynx.bundle`, you can change `server.base` to `/foo`
   *
   * you can refer to {@link https://rsbuild.dev/config/server/base | server.base } for more information.
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   server: {
   *     base: '/dist'
   *   },
   * })
   * ```
   */
  base?: string | undefined

  /**
   * Configure whether to enable {@link https://developer.mozilla.org/en-US/docs/Glossary/gzip_compression | gzip compression } for static assets served by the dev server or preview server.
   *
   * Default: true
   *
   * See {@link https://rsbuild.rs/config/server/compress | Rsbuild - server.compress } for details.
   *
   * @example
   *
   * To disable the gzip compression, set compress to false:
   *
   * ```js
   * export default {
   *   server: {
   *     compress: false,
   *   },
   * }
   * ```
   *
   * @example
   *
   * Compress if it starts with /foo
   *
   * ```js
   * export default {
   *   server: {
   *     compress: {
   *       filter: (req) => {
   *         if (req.url?.includes('/foo')) {
   *           return false;
   *         }
   *         return true;
   *       },
   *     },
   *   },
   * }
   * ```
   *
   * @example
   *
   * set level of zlib compression
   *
   * ```js
   * export default {
   *   server: {
   *     compress: {
   *       level: 6,
   *     },
   *   },
   * }
   * ```
   */
  compress?: boolean | CompressOptions | undefined

  /**
   * Configure CORS for the dev server or preview server.
   *
   * - Set to an object to enable CORS with the specified options.
   *
   * - Set to `true` to enable CORS with the default options (allows all origins, not recommended).
   *
   * - Set to `false` to disable CORS.
   *
   * See {@link https://rsbuild.rs/config/server/cors | Rsbuild - server.cors } for details.
   *
   * @example
   *
   * ```js
   * export default {
   *   server: {
   *     cors: {
   *       origin: 'https://example.com',
   *     },
   *   },
   * }
   * ```
   */
  cors?: ServerConfig['cors'] | undefined

  /**
   * Adds headers to all responses.
   *
   * @example
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   server: {
   *     headers: {
   *       'Access-Control-Allow-Origin': '**',
   *     },
   *   },
   * })
   * ```
   */
  headers?: Record<string, string | string[]> | undefined

  /**
   * Specify the host that the Rspeedy Server listens to.
   *
   * @remarks
   * By default, the server listens on local network IP, for example, `192.168.1.50`, verify your local net IP by the command `ifconfig` on your system for (en0 for MacOS and eth0 for LinuxOS users). In case you have multiple local network IP(s) particularly when you are running dockers on the host machine, then you can specify your desired host IP.
   *
   * @example
   *
   * Set the host to a custom value:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   server: {
   *     host: "192.168.1.50",
   *   },
   * })
   * ```
   */
  host?: string | undefined

  /**
   * Specify the port that the Rspeedy Server listens to.
   *
   * @remarks
   * By default, the server listens on port `3000` and automatically increments the port number when the port is occupied.
   *
   * @example
   *
   * Set the port to a custom value:
   *
   * ```js
   * import { defineConfig } from '@lynx-js/rspeedy'
   * export default defineConfig({
   *   server: {
   *     port: 3470,
   *   },
   * })
   * ```
   */
  port?: number | undefined

  /**
   * Configure proxy rules for the dev server or preview server to proxy requests to the specified service.
   *
   * @example
   *
   * ```js
   * export default {
   *   server: {
   *     proxy: {
   *       // http://localhost:3000/api -> http://localhost:3000/api
   *       // http://localhost:3000/api/foo -> http://localhost:3000/api/foo
   *       '/api': 'http://localhost:3000',
   *     },
   *   },
   * }
   * ```
   */
  proxy?: ProxyConfig | undefined

  /**
   * When a port is occupied, Rspeedy will automatically increment the port number until an available port is found.
   *
   * Set strictPort to true and Rspeedy will throw an exception when the port is occupied.
   */
  strictPort?: boolean | undefined
}
