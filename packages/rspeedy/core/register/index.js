// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Copyright 2024 Bloomberg Finance L.P.
// Distributed under the terms of the Apache 2.0 license.

import module from 'node:module'

/**
 * Register the ESM loader for TypeScript.
 *
 * @returns - The `unregister` function.
 */
export function register(options) {
  // Check for Deno environment first
  // @ts-expect-error - Deno global isn't defined in Node.js
  if (typeof Deno !== 'undefined' || process.versions?.deno) {
    // Deno doesn't support module.register(), but it has native TypeScript support
    // Return a no-op unregister function
    return function unregister() {
      // No-op for Deno
    }
  }

  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  if (!module.register) {
    throw new Error(
      [
        `This version of Node.js (${process.version}) does not support module.register(). You can either:`,
        `  - Upgrade to Node.js v18.19 or v20.6 and above`,
        `  - Use \`lynx.config.js\` instead of \`lynx.config.ts\``,
      ].join('\n'),
    )
  }

  const { port1, port2 } = new MessageChannel()

  // We have checked if `module.register` exists before.
  // eslint-disable-next-line n/no-unsupported-features/node-builtins
  module.register(
    // Load a copy of loader so it can be registered multiple times
    `./hooks.js?${Date.now()}`,
    import.meta.url,
    {
      parentURL: import.meta.url,
      data: {
        options,
        port: port2,
      },
      transferList: [port2],
    },
  )

  return function unregister() {
    port1.postMessage('deactivate')
  }
}
