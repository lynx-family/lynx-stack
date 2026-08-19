// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRsbuild } from '@rsbuild/core'

import { pluginReactLynx } from '@lynx-js/react-rsbuild-plugin'
import { createRspeedy } from '@lynx-js/rspeedy'

const [tool, mode, root] = process.argv.slice(2)
const cwd = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')

const config = {
  mode,
  environments: { lynx: {} },
  source: { entry: { main: './fixtures/basic.tsx' } },
  // `chunk.hash` is not reproducible across builds, and both the content hash
  // in a filename and the debug metadata release are keyed on it. The filename
  // hash is turned off and the release is stripped before comparing; minifying
  // is turned off as well, because a release that differs by one string still
  // permutes every mangled name.
  output: { distPath: { root }, filenameHash: false, minify: false },
  plugins: [pluginReactLynx()],
}

if (tool === 'rspeedy') {
  const rspeedy = await createRspeedy({ cwd, rspeedyConfig: config })
  await rspeedy.build()
} else {
  const rsbuild = await createRsbuild({ cwd, rsbuildConfig: config })
  await rsbuild.build()
}
