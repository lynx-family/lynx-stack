// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { existsSync } from 'node:fs'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'

import { describe, expect, test, vi } from 'vitest'

import { createStubRspeedy as createRspeedy } from './createRspeedy.js'

vi.stubEnv('USE_RSPACK', 'true').stubEnv('NODE_ENV', 'production')

describe('Private Property Support', () => {
  test('transpiles private class fields to ES2019', async () => {
    const { pluginReactLynx } = await import('../src/index.js')

    const tmp = await mkdtemp(path.join(tmpdir(), 'rspeedy-react-test-private'))

    const rspeedy = await createRspeedy({
      rspeedyConfig: {
        source: {
          entry: {
            main: new URL(
              './fixtures/private-property/index.tsx',
              import.meta.url,
            ).pathname,
          },
        },
        output: {
          distPath: {
            root: tmp,
          },
          filenameHash: false,
          minify: false, // Disable minification to verify transpilation
        },
        plugins: [
          pluginReactLynx(),
        ],
      },
    })

    await rspeedy.build()

    // Check that the build succeeded and files exist
    const lynxBundle = path.join(tmp, 'main.lynx.bundle')
    expect(existsSync(lynxBundle)).toBe(true)

    // Read the bundle and verify private fields are transpiled
    // Private fields should be transpiled to WeakMap or similar pattern
    // and should NOT contain the # syntax
    const bundleContent = await readFile(lynxBundle, 'utf-8')

    // The bundle should not contain private field syntax (#privateProperty)
    // because it should be transpiled for ES2019 target
    expect(bundleContent).not.toContain('#privateProperty')

    // Should contain WeakMap (or similar transpilation pattern)
    // Note: The actual implementation might use WeakMap or a different pattern
    // This is a basic check to ensure transpilation happened
    const hasTranspilation = bundleContent.includes('WeakMap')
      || bundleContent.includes('_classPrivateFieldGet')
      || bundleContent.includes('_classPrivateFieldSet')
    expect(hasTranspilation).toBe(true)
  })
})
