// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { log } from '@clack/prompts'
import color from 'picocolors'
import { renderUnicodeCompact } from 'uqr'

export default function showQRCode(url: string): void {
  log.info(color.green('Scan with Lynx'))
  log.success(renderUnicodeCompact(url))
  log.success(url)
}
