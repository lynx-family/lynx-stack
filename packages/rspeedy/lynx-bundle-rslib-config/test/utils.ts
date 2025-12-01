// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import fs from 'node:fs'

interface DecodeTemplateResult {
  'custom-sections': Record<string, string>
  'engine-version': string
}

export async function decodeTemplate(
  templatePath: string,
): Promise<DecodeTemplateResult> {
  const { decode_napi, decode_wasm } = await import('@lynx-js/tasm')

  const isWindows = process.platform === 'win32'
  const decodeFn = isWindows ? decode_wasm : decode_napi

  const template = await fs.promises.readFile(templatePath)

  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const ret = decodeFn(template)

  return ret as DecodeTemplateResult
}
