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
  // TODO: restore the defaults once swc-project/swc#12129 lands.
  output: { distPath: { root }, filenameHash: false, minify: false },
  plugins: [pluginReactLynx()],
}

if (tool === 'rspeedy') {
  const rspeedy = await createRspeedy({ cwd, rspeedyConfig: config })
  const { close } = await rspeedy.build()
  await close()
} else {
  const rsbuild = await createRsbuild({ cwd, rsbuildConfig: config })
  const { close } = await rsbuild.build()
  await close()
}
