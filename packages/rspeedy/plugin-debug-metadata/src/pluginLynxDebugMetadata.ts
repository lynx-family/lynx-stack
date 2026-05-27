// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import type { RsbuildPlugin, RsbuildPluginAPI } from '@rsbuild/core'

import type { LynxTemplatePlugin } from '@lynx-js/template-webpack-plugin'

import { LynxDebugMetadataPlugin } from './LynxDebugMetadataPlugin.js'
import { createDebugMetadataMiddleware } from './middleware.js'
import type { CompilerHandle } from './middleware.js'

const PLUGIN_NAME = 'lynx:debug-metadata'

/**
 * Resolve the origin (plus path) used to rewrite source-map trailers from a
 * dev `assetPrefix`. The prefix may be an absolute URL (`http://localhost:<port>/`)
 * or a path-only public path (`/assets/`). The latter is resolved against a
 * placeholder base so it doesn't throw, and the placeholder origin is then
 * dropped so the rewritten trailer stays relative. Returns `undefined` when no
 * usable prefix can be derived (unparsable, or an empty root path).
 *
 * @param assetPrefix - `dev.assetPrefix`, possibly containing a `<port>` token.
 * @param port - dev-server port substituted for `<port>`.
 */
export function resolveAssetPrefixOrigin(
  assetPrefix: string,
  port: number | string,
): string | undefined {
  const prefix = assetPrefix.replaceAll('<port>', String(port))
  const placeholder = 'http://debug-metadata.placeholder'
  let url: URL
  try {
    url = new URL(prefix, placeholder)
  } catch {
    return
  }
  const origin = url.origin === placeholder ? '' : url.origin
  return (origin + url.pathname).replace(/\/$/, '') || undefined
}

function devServerOrigin(api: RsbuildPluginAPI): string | undefined {
  if (!api.context.devServer) return
  const { assetPrefix } = api.getNormalizedConfig().dev
  if (typeof assetPrefix !== 'string') return
  return resolveAssetPrefixOrigin(assetPrefix, api.context.devServer.port)
}

interface LynxTemplatePluginExposure {
  LynxTemplatePlugin: typeof LynxTemplatePlugin
}

/**
 * Register `debug-metadata.json` emission for every Lynx template build
 * and serve sub-field queries via a connect-style dev-server middleware.
 *
 * Auto-registered by Rspeedy core.
 *
 * The dev-server middleware exposes these endpoints (relative to each
 * entry's intermediate dir):
 *
 * ```text
 * GET .../debug-metadata.json
 * GET .../debug-metadata.json?field=source-map&path=…
 * GET .../debug-metadata.json?field=source-map&filename=…
 * GET .../debug-metadata.json?field=source-map&key=…
 * GET .../debug-metadata.json?field=bytecode-debug-info&filename=…
 * GET .../debug-metadata.json?field=artifact&filename=…
 * GET .../debug-metadata.json?field=artifacts
 * GET .../debug-metadata.json?field=ui-source-map
 * GET .../debug-metadata.json?field=meta
 * GET .../debug-metadata.json?field=git
 * GET .../debug-metadata.json?field=rspeedy
 *
 * GET .../*.js.map    → transparently forwarded to ?field=source-map
 * GET .../*.css.map   → transparently forwarded to ?field=source-map
 * ```
 *
 * @public
 */
export function pluginLynxDebugMetadata(): RsbuildPlugin {
  return {
    name: PLUGIN_NAME,
    setup(api) {
      const compilerHandle: CompilerHandle = { compiler: null }

      api.onAfterCreateCompiler(({ compiler }) => {
        compilerHandle.compiler = compiler
      })

      api.modifyBundlerChain((chain, { environment }) => {
        // biome `useHookAtTopLevel` lint doesn't trip — it's an rsbuild
        // API, not a React hook, but the name prefix matches.
        const exposed = api.useExposed<LynxTemplatePluginExposure>(
          Symbol.for('LynxTemplatePlugin'),
        )

        // Non-lynx envs (e.g. the `web` env in a multi-env build) share
        // the same `intermediate` dir with the lynx env in rspeedy's
        // entry plumbing — emitting our metadata there would overwrite
        // the lynx one with web-asset paths, and rewriting web JS
        // trailers would point them at a metadata file whose artifacts
        // don't include the web asset paths. Web JS source maps work
        // fine via the default `.map` sibling; skip cleanly.
        const isLynx = environment.name === 'lynx'
          || environment.name.startsWith('lynx-')
        if (!isLynx) return

        if (!exposed) return

        chain.plugin(PLUGIN_NAME).use(LynxDebugMetadataPlugin, [{
          LynxTemplatePlugin: exposed.LynxTemplatePlugin,
          rsbuildEntry: environment.entry,
          getDevServerOrigin: () => devServerOrigin(api),
        }])
      })

      api.onBeforeStartDevServer(({ server }) => {
        const mw = createDebugMetadataMiddleware({ compilerHandle })
        server.middlewares.use(mw)
      })
    },
  }
}
