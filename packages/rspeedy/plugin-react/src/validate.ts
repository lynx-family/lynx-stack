// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import * as typia from 'typia'

import type { PluginReactLynxOptions } from './pluginReactLynx.js'

export const validateConfig: (
  input: unknown,
) => PluginReactLynxOptions | undefined = typia.createAssertEquals<
  PluginReactLynxOptions | undefined
>(({ path, expected, value }) => {
  if (expected === 'undefined') {
    const errorMessage =
      `Unknown property: \`${path}\` in the configuration of pluginReactLynx`

    // Unknown properties
    return new Error(errorMessage)
  }

  return new Error(
    [
      `Invalid config on pluginReactLynx: \`${path}\`.`,
      `  - Expect to be ${expected}`,
      `  - Got: ${whatIs(value)}`,
      '',
    ].join('\n'),
  )
})

function whatIs(value: unknown): string {
  return Object.prototype.toString.call(value)
    .replace(/^\[object\s+([a-z]+)\]$/i, '$1')
    .toLowerCase()
}
