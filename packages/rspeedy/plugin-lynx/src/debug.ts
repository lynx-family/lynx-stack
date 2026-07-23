// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import color from 'picocolors'

export const isDebug = (): boolean => {
  if (!process.env['DEBUG']) {
    return false
  }

  const values = process.env['DEBUG'].toLocaleLowerCase().split(',')
  return ['rsbuild', 'rspeedy', '*'].some((key) => values.includes(key))
}

const label = color.bgCyan('lynx')

export const debug = (message: string | (() => string)): void => {
  if (isDebug()) {
    const result = typeof message === 'string' ? message : message()
    // Add `logger.level` since `logger.debug` will not print when `DEBUG=rspeedy`
    logger.level = 'verbose'
    logger.debug(`${label} ${result}`)
  }
}

export const debugList = (
  prefix: string,
  messages: string | string[],
): void => {
  return debug(() => `${prefix} ${[''].concat(messages).join('\n    - ')}`)
}
