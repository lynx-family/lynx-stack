// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs'
import { extname, isAbsolute, join } from 'node:path'
import { pathToFileURL } from 'node:url'

import color from 'picocolors'

import { register } from '#register'

import { debug } from '../debug.js'
import type { ConfigExport } from './defineConfig.js'

import type { Config } from './index.js'

export const resolveConfigPath = (
  root: string,
  customConfig?: string,
): string => {
  if (customConfig) {
    debug(`load custom config file ${customConfig} from ${root}`)
    const customConfigPath = isAbsolute(customConfig)
      ? customConfig
      : join(root, customConfig)
    if (fs.existsSync(customConfigPath)) {
      return customConfigPath
    }

    throw new Error(`Cannot find config file: ${color.dim(customConfigPath)}`)
  }

  const CONFIG_FILES = [
    'lynx.config.ts',
    'lynx.config.js',
    'lynx.config.mts',
    'lynx.config.mjs',
  ] as const

  for (const file of CONFIG_FILES) {
    debug(`load default config file ${file} from ${root}`)
    const configFile = join(root, file)

    if (fs.existsSync(configFile)) {
      debug(`default config ${configFile} found`)
      return configFile
    }
  }

  throw new Error([
    `Cannot find the default config file: ${
      color.dim(join(root, CONFIG_FILES[0]))
    }.`,
    `Use custom config with ${color.green('`--config <config>`')} options.`,
  ].join(' '))
}

/**
 * The options of loadConfig.
 *
 * @public
 */
export interface LoadConfigOptions {
  configPath?: string | undefined
  cwd?: string | undefined
}

/**
 * The result of {@link loadConfig}.
 *
 * @public
 */
export interface LoadConfigResult {
  /**
   * The configuration object that exported from the configuration file.
   *
   * @remarks
   *
   * The returned object has already been validated.
   */
  content: Config
  /**
   * The configuration path that has been loaded.
   */
  configPath: string
}

/**
 * Load the build config by the config path.
 *
 * @param loadConfigOptions - the options of `loadConfig` method.
 * @returns Build config.
 *
 * @example
 *
 * ```ts
 * import { loadConfig } from '@lynx-js/rspeedy'
 *
 * void async function () {
 *   const config = await loadConfig({ configPath: './lynx.config.js' })
 *   console.log(config);
 * }()
 * ```
 *
 * @public
 */
export async function loadConfig(
  loadConfigOptions: LoadConfigOptions,
): Promise<LoadConfigResult> {
  let { configPath } = loadConfigOptions

  if (!configPath || !isAbsolute(configPath)) {
    configPath = resolveConfigPath(
      loadConfigOptions.cwd ?? process.cwd(),
      configPath,
    )
  }

  // Note that we are using `pathToFileURL` since absolute paths must be valid file:// URLs on Windows.
  const specifier = pathToFileURL(configPath).toString()

  let unregister: () => void

  if (shouldUseNativeImport(configPath)) {
    unregister = () => {
      // No-op: Native TypeScript support handles module loading
    }
  } else {
    unregister = register({
      load: !hasNativeTSSupport(),
      resolve: true,
    })
  }

  try {
    const [exports, { validate }] = await Promise.all([
      import(
        /* webpackIgnore: true */ `${specifier}?t=${Date.now()}`
      ) as Promise<{ default: ConfigExport } | ConfigExport>,
      import('./validate.js'),
    ])

    const configExport = 'default' in exports ? exports.default : exports

    const rawContent: Config = typeof configExport === 'function'
      ? await configExport({
        command: process.argv[2] ?? 'build',
        env: process.env['NODE_ENV'] ?? 'production',
      })
      : await configExport

    return {
      configPath,
      content: validate(rawContent, configPath),
    }
  } finally {
    unregister()
  }
}

function shouldUseNativeImport(configPath: string): boolean {
  return isJavaScriptPath(configPath) || isDeno()
}

function hasNativeTSSupport(): boolean {
  if (isDeno()) return true

  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  if (process.features.typescript) {
    // This is added in Node.js v22.10.
    // 1. Node.js v22.10+ with --experimental-transform-types or --experimental-strip-types
    // 2. Node.js v23.6+
    return true
    // eslint-disable-next-line n/no-unsupported-features/node-builtins
  } else if (process.features.typescript === false) {
    // 1. Node.js v22.10+ without --experimental-transform-types or --experimental-strip-types
    // 2. Node.js v23.6+ with --no-experimental-strip-types
    return false
  }

  // Node.js < v22.10
  const { NODE_OPTIONS } = process.env

  if (!NODE_OPTIONS) {
    return false
  }

  return NODE_OPTIONS.includes('--experimental-transform-types')
    || NODE_OPTIONS.includes('--experimental-strip-types')
}

function isJavaScriptPath(configPath: string): boolean {
  const ext = extname(configPath)
  return ['.js', '.mjs', '.cjs'].includes(ext)
}

function isDeno(): boolean {
  // @ts-expect-error - Deno global isn't defined in Node.js
  if (typeof Deno !== 'undefined' || process.versions?.deno) {
    return true
  }
  return false
}

export function TEST_ONLY_hasNativeTSSupport(): boolean {
  return hasNativeTSSupport()
}
