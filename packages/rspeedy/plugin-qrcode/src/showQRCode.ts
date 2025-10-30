// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { log } from '@clack/prompts'
import color from 'picocolors'
import { renderUnicodeCompact } from 'uqr'

export default function showQRCode(
  lynxUrl?: string,
  webUrls?: Record<string, string>,
): void {
  if (lynxUrl) {
    log.info(color.green('Scan with Lynx'))
    log.success(renderUnicodeCompact(lynxUrl))
    log.success('Lynx Explorer: ' + lynxUrl)
  }
  if (webUrls) {
    for (const [name, webUrl] of Object.entries(webUrls)) {
      log.success(`Web Preview for ${name}: ` + webUrl)
    }
  }
}
