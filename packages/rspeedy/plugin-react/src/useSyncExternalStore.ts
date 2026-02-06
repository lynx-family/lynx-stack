// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI } from '@rsbuild/core'

export function applyUseSyncExternalStore(api: RsbuildPluginAPI): void {
  api.modifyBundlerChain(async (chain, { rspack }) => {
    const { getImportResolver } = await import('./resolve.js')
    const resolve = getImportResolver(rspack)
    const useSyncExternalStoreEntries = [
      'use-sync-external-store',
      'use-sync-external-store/with-selector',
      'use-sync-external-store/with-selector.js',
      'use-sync-external-store/shim',
      'use-sync-external-store/shim/with-selector',
      'use-sync-external-store/shim/with-selector.js',
    ]

    await Promise.all(
      useSyncExternalStoreEntries.map(key => {
        const entry = key.endsWith('.js') ? key.replace('.js', '') : key
        return resolve(`@lynx-js/${entry}`).then(value => {
          chain
            .resolve
            .alias
            .set(`${key}$`, value)
        })
      }),
    )
  })
}
