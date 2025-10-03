// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import type { RsbuildPluginAPI } from '@rsbuild/core'

import type { ExposedAPI } from '@lynx-js/rspeedy'

import type { CustomizedSchemaFn } from './index.js'

export default function generateDevUrls(
  api: RsbuildPluginAPI,
  entry: string,
  schemaFn: CustomizedSchemaFn,
  port: number,
): { lynx: Record<string, string>, web: string } {
  const { dev: { assetPrefix } } = api.getNormalizedConfig()
  const { config } = api.useExposed<ExposedAPI>(
    Symbol.for('rspeedy.api'),
  )!

  if (typeof assetPrefix !== 'string') {
    const errorMsg = 'dev.assetPrefix is not string, skip printing QRCode'
    // Rspeedy will normalized dev.assetPrefix to string
    throw new Error(errorMsg)
  }

  const defaultFilename = '[name].[platform].bundle'
  const { filename } = config.output ?? {}
  let name: string
  if (!filename) {
    name = defaultFilename
  } else if (typeof filename === 'object') {
    name = filename.bundle ?? filename.template ?? defaultFilename
  } else {
    name = filename
  }

  // <port> is supported in `dev.assetPrefix`, we should replace it with the real port
  let base: string
  try {
    base = new URL(
      '',
      assetPrefix.replaceAll('<port>', String(port)),
    ).toString()
  } catch {
    // the assetPrefix is not a valid URL, fallback to localhost
    base = `http://localhost:${port}/`
  }
  const customSchema = schemaFn(
    new URL(
      name.replace('[name]', entry).replace('[platform]', 'lynx'),
      base,
    ).toString(),
  )

  const outputPathname = new URL(
    name.replace('[name]', entry).replace('[platform]', 'web'),
    base,
  ).pathname
  const web = new URL(
    `/web?casename=${outputPathname}`,
    base,
  ).toString()

  const lynx = typeof customSchema === 'string'
    ? { default: customSchema }
    : customSchema

  return { lynx, web }
}
