// Copyright 2025 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPluginAPI } from '@rsbuild/core'

export function applyUseSyncExternalStore(api: RsbuildPluginAPI): void {
  api.modifyBundlerChain(async chain => {
    const { resolve } = await import('./resolve.js')
    const useSyncExternalStoreEntries = [
      'use-sync-external-store',
      'use-sync-external-store/with-selector',
      'use-sync-external-store/shim',
      'use-sync-external-store/shim/with-selector',
    ]

    await Promise.all(
      useSyncExternalStoreEntries.map(entry =>
        resolve(`@lynx-js/${entry}`).then(value => {
          chain
            .resolve
            .alias
            .set(`${entry}$`, value)
        })
      ),
    )
  })
}
