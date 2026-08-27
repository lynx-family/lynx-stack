// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import type { LynxConfig } from '@lynx-js/rsbuild-plugin'

import type { CustomizedSchemaFn } from './index.js'

const S_LYNX_CONFIG = Symbol.for('@lynx-js/rsbuild-plugin:config')

export default function generateDevUrls(
  api: RsbuildPluginAPI,
  entry: string,
  schemaFn: CustomizedSchemaFn,
  port: number,
): Record<string, string> {
  const { dev: { assetPrefix } } = api.getNormalizedConfig()

  if (typeof assetPrefix !== 'string') {
    const errorMsg = 'dev.assetPrefix is not string, skip printing QRCode'
    // Rspeedy will normalized dev.assetPrefix to string
    throw new Error(errorMsg)
  }

  // biome-ignore lint/correctness/useHookAtTopLevel: This is not a React hook.
  const lynxConfig = api.useExposed<LynxConfig>(S_LYNX_CONFIG)

  if (!lynxConfig) {
    throw new Error(
      'No Lynx config exposed. `pluginLynx` has to be applied for the Lynx build engine to be configured.',
    )
  }

  // QRCode always points at the Lynx main bundle.
  const name = lynxConfig.resolveBundleFilename({
    entryName: entry,
    platform: 'lynx',
  })

  const customSchema = schemaFn(
    new URL(
      name,
      // <port> is supported in `dev.assetPrefix`, we should replace it with the real port
      assetPrefix.replaceAll('<port>', String(port)),
    ).toString(),
  )

  return typeof customSchema === 'string'
    ? { default: customSchema }
    : customSchema
}
