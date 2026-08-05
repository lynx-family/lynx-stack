// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/**
 * Where the `<Background>` fold stops, and why.
 *
 * The fold removes a JSX *reference*. Whether the deferred module then leaves
 * the main-thread bundle — and with it its top-level side effects, the thing
 * `'background only'` had to be written by hand for — is decided by the
 * bundler's reachability analysis over the whole graph, not by the fold.
 *
 * So the rule is:
 *
 *   a deferred module's top-level stops running on the main thread
 *   IFF every reference to it lies inside a folded boundary.
 *
 * This file pins both sides of that rule: the shapes where the reference is
 * enclosed (A, C, D, G, J) and the shapes where one is authored outside it
 * (B shared with the shell, E slotted through a wrapper, F hoisted binding).
 * The second group is not a bug to fix later — no module-local syntactic
 * transform can see those references — which is why `import 'background-only'`
 * exists to turn them into a build error.
 */
import fs from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { RsbuildPlugin, Rspack } from '@rsbuild/core'
import { describe, expect, rstest, test } from '@rstest/core'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'
import type { PluginReactLynxOptions } from '../src/pluginReactLynx.js'

rstest
  .stubEnv('USE_RSPACK', 'true')
  .stubEnv('NODE_ENV', 'production')

const ignoreCSSLoaderWorkaround = {
  name: 'ignore-css-loader-workaround',
  pre: ['lynx:react'],
  setup(api) {
    api.modifyBundlerChain((chain, { CHAIN_ID }) => {
      const rule = chain.module
        .rules.get('css:react:main-thread')
        .uses.get(CHAIN_ID.USE.IGNORE_CSS)
      rule.loader(rule.get('loader') as string + '.ts')
    })
  },
} as RsbuildPlugin

function collectAssets(assets: Record<string, string>) {
  return {
    name: 'collect-assets',
    apply(compiler: Rspack.Compiler) {
      compiler.hooks.compilation.tap('collect-assets', (compilation) => {
        compilation.hooks.processAssets.tap('collect-assets', (files) => {
          for (const name in files) {
            assets[name] = files[name]!.source().toString()
          }
        })
      })
    },
  } as Rspack.RspackPluginInstance
}

const FIXTURE_DIR = fileURLToPath(new URL('./fixtures/perm', import.meta.url))

async function mainThread(
  options: PluginReactLynxOptions,
  mode: 'production' | 'development' = 'production',
): Promise<string> {
  const { pluginReactLynx } = await import('../src/pluginReactLynx.js')
  const assets: Record<string, string> = {}
  const tmp = await fs.mkdtemp(path.join(tmpdir(), 'rspeedy-react-boundary-'))
  const rsbuild = await createRspeedy({
    rspeedyConfig: {
      mode,
      source: { entry: { main: path.join(FIXTURE_DIR, 'index.tsx') } },
      output: { distPath: { root: tmp }, minify: false },
      plugins: [pluginReactLynx(options), ignoreCSSLoaderWorkaround],
      tools: { rspack: { plugins: [collectAssets(assets)] } },
    },
  })
  try {
    await rsbuild.build()
  } finally {
    await fs.rm(tmp, { recursive: true, force: true })
  }
  return assets['.rspeedy/main/main-thread.js']!
}

const ISLANDS: PluginReactLynxOptions = {
  experimental_enableMTSRendering: true,
  experimental_backgroundIslands: true,
}

describe('the fold\'s boundary', () => {
  test('eliminates top-level side effects when every reference is enclosed', async () => {
    const islands = await mainThread(ISLANDS)
    const classic = await mainThread({ experimental_enableMTSRendering: true })

    const enclosed = [
      // the deferred module's own top level
      'MK_A1_OWN_TOPLEVEL',
      // a module only that deferred module imports
      'MK_A2_TRANSITIVE_TOPLEVEL',
      // reached through a namespace member expression
      'MK_C_NAMESPACE_TOPLEVEL',
      // the child is the result of a call, not a JSX identifier
      'MK_D_CALL_TOPLEVEL',
      // the boundary sits inside a component that is itself first-screen
      'MK_G_DEFERRED_TOPLEVEL',
      // a deferred module that also defines a worklet
      'MK_J_WORKLET_TOPLEVEL',
      // and the render body, without any directive on it
      'MK_A_BODY_LOGIC',
    ]
    for (const marker of enclosed) {
      expect(classic, `${marker} should be there without the fold`).toContain(
        marker,
      )
      expect(islands, `${marker} should be folded away`).not.toContain(marker)
    }
  })

  test('keeps them when a reference is authored outside the boundary', async () => {
    const islands = await mainThread(ISLANDS)

    // Not a gap in the implementation: each of these is a reference the fold
    // cannot see, because it is not inside the boundary it rewrites.
    const escaping = [
      // imported by the shell as well — it has to be in the bundle
      'MK_B_SHARED_TOPLEVEL',
      // <Wrapper><Slotted/></Wrapper>: the reference is in the caller, the
      // boundary is inside Wrapper
      'MK_E_SLOTTED_TOPLEVEL',
      // const Picked = … : the binding is evaluated at module scope
      'MK_F_COMPUTED_TOPLEVEL',
    ]
    for (const marker of escaping) {
      expect(islands, `${marker} cannot be folded away`).toContain(marker)
    }
  })

  test('the function directive still strips those render bodies', async () => {
    // What is left for `'background only'` to do: the reference survives, so
    // the module stays, but its render body does not have to.
    const islands = await mainThread(ISLANDS)
    const classic = await mainThread({ experimental_enableMTSRendering: true })

    for (const marker of ['MK_E_BODY_LOGIC', 'MK_F_BODY_LOGIC']) {
      expect(islands).not.toContain(marker)
      // …in every mode, including the classic build.
      expect(classic).not.toContain(marker)
    }
  })

  test('the first screen and the assembled definitions are unaffected', async () => {
    const islands = await mainThread(ISLANDS)

    // Everything outside a boundary still renders.
    expect(islands).toContain('MK_SHELL_RENDERS')
    expect(islands).toContain('MK_G_SHELL_RENDERS')
    expect(islands).toContain('MK_SKELETON')
    // A worklet defined in a folded module still reaches the main thread,
    // through the assembly rather than through its module.
    expect(islands).toContain('MK_J_WORKLET_BODY')
  })

  test('development keeps every module, the component defers at runtime', async () => {
    const dev = await mainThread(ISLANDS, 'development')
    expect(dev).toContain('MK_A1_OWN_TOPLEVEL')
    expect(dev).toContain('MK_A_BODY_LOGIC')
  })
})
