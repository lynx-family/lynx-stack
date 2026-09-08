// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
/**
 * Options for the optional, built-in Rsdoctor 2.0 plugin.
 * Self-contained so consumers can omit the plugin without breaking type resolution.
 *
 * Keep this type free of deeply nested/intersection utility types to ensure
 * typia can generate validators from `Config`.
 *
 * @public
 */
export interface RsdoctorRspackPluginOptions {
  /** Custom SDK instances are opaque to the config validator. */
  sdkInstance?: object
  linter?: {
    rules?: Record<string, unknown>
    level?: 'Ignore' | 'Warn' | 'Error'
    extends?: unknown[]
  }
  multiCompiler?: boolean | { group?: string }
  disableClientServer?: boolean
  innerClientPath?: string
  printLog?: { serverUrls: boolean }
  loaderInterceptorOptions?: { skipLoaders?: string[] }
  features?: Partial<Record<RsdoctorFeature, boolean>> | RsdoctorFeature[]
  supports?: {
    banner?: boolean
    parseBundle?: boolean
    gzip?: boolean | { gzipLevel?: number }
  }
  server?: {
    port?: number
    cors?: boolean | {
      origin?:
        | RsdoctorCorsOrigin
        | ((
          requestOrigin: string | undefined,
          callback: (error: Error | null, origin?: RsdoctorCorsOrigin) => void,
        ) => void)
      methods?: string | string[]
      allowedHeaders?: string | string[]
      exposedHeaders?: string | string[]
      credentials?: boolean
      maxAge?: number
      preflightContinue?: boolean
      optionsSuccessStatus?: number
    }
  }
  output?:
    & { reportDir?: string }
    & ({
      mode?: 'normal'
      reportCodeType?:
        | 'noModuleSource'
        | 'noAssetsAndModuleSource'
        | 'noCode'
        | undefined
      options?: { type?: never }
    } | {
      mode?: 'brief'
      reportCodeType?: 'noCode' | undefined
      options?: {
        type?: ('html' | 'json')[]
        htmlOptions?: { reportHtmlName?: string }
        jsonOptions?: {
          fileName?: string
          sections?: {
            moduleGraph?: boolean
            chunkGraph?: boolean
            rules?: boolean
          }
        }
      }
    })
}

/** @public */
export type RsdoctorFeature =
  | 'loader'
  | 'plugins'
  | 'resolver'
  | 'bundle'
  | 'treeShaking'
  | 'lite'
/** @public */
export type RsdoctorCorsOrigin =
  | boolean
  | string
  | RegExp
  | (boolean | string | RegExp)[]
