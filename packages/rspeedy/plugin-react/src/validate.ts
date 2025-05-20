// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as typia from 'typia'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

const validate: (
  input: unknown,
) => typia.IValidation<PluginReactLynxOptions | undefined> = typia
  .createValidateEquals<PluginReactLynxOptions | undefined>()

export const validateConfig: (
  input: unknown,
) => PluginReactLynxOptions | undefined = (input: unknown) => {
  const result = validate(input)

  if (result.success) {
    return result.data
  }

  const messages: string[] = result
    .errors
    .flatMap(({ expected, path, value }) => {
      // Ignore the internal options
      // See: #846
      if (
        path
        && (path === '$input.jsx' || path.startsWith('$input.jsx.'))
        && expected === 'undefined'
      ) {
        return null
      }

      if (expected === 'undefined') {
        return `Unknown property: \`${path}\` in the configuration of pluginReactLynx`
      }
      return [
        `Invalid config on pluginReactLynx: \`${path}\`.`,
        `  - Expect to be ${expected}`,
        `  - Got: ${whatIs(value)}`,
        '',
      ]
    })
    .filter(message => message !== null)

  if (messages.length === 0) {
    return result.data as PluginReactLynxOptions | undefined
  }

  throw new Error(messages.join('\n'))
}

function whatIs(value: unknown): string {
  return Object.prototype.toString.call(value)
    .replace(/^\[object\s+([a-z]+)\]$/i, '$1')
    .toLowerCase()
}
