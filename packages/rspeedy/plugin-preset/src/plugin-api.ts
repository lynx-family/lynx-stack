// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { logger } from '@rsbuild/core'
import type { RsbuildPlugin } from '@rsbuild/core'

import type { ExposedAPI } from './api.js'
import type { Config } from './config/index.js'
import { version } from './version.js'

/**
 * Publish the Lynx-shaped build API that DSL plugins
 * (e.g. `@lynx-js/react-rsbuild-plugin`) and the reused Rspeedy internal
 * plugins read to discover the config.
 *
 * @remarks
 * Two symbols carry the same object:
 * - `rspeedy.api` — what the Rspeedy CLI publishes; the reused internal plugins
 *   (e.g. `pluginDev`) still read this.
 * - `lynx.api` — the caller-neutral contract DSL plugins are migrating to.
 *
 * The plugin is named `lynx:rsbuild:plugin-api` to match the Rspeedy CLI, so
 * DSL plugins' `pre: ['lynx:rsbuild:plugin-api']` ordering hint resolves.
 */
export function pluginLynxAPI(config: Config): RsbuildPlugin {
  return {
    name: 'lynx:rsbuild:plugin-api',
    setup(api) {
      const exposed: ExposedAPI = {
        config,
        debug: (message) =>
          logger.debug(typeof message === 'function' ? message() : message),
        // No Rspeedy CLI process to terminate when running on Rsbuild directly.
        exit: () => undefined,
        logger,
        version,
      }
      api.expose<ExposedAPI>(Symbol.for('rspeedy.api'), exposed)
      api.expose<ExposedAPI>(Symbol.for('lynx.api'), exposed)
    },
  }
}
