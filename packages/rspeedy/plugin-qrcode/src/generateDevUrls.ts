// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import { getLynxConfig, resolveBundleFilename } from '@lynx-js/rsbuild-plugin'

import type { CustomizedSchemaFn } from './index.js'

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

  const lynx = getLynxConfig(api)
  // QRCode always points at the Lynx main bundle.
  const name = resolveBundleFilename(lynx, {
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
