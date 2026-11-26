// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// Builds the two-card fixture once, for the static e2e tests, without hot
// updates.
// Usage: node tests/node/build-fixture.mjs <outDir> [development|production]
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { createRsbuild } from '@rsbuild/core';

import { projectConfig } from './fixture-config.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(here, '../../fixtures/two-cards');
const outDir = path.resolve(process.argv[2]);
const mode = process.argv[3] === 'production' ? 'production' : 'development';

const rsbuild = await createRsbuild({
  cwd: root,
  rsbuildConfig: projectConfig({
    root,
    distPath: outDir,
    entries: { main: 'src/main.tsx', detail: 'src/detail.tsx' },
    mode,
    hmr: false,
  }),
});
await rsbuild.build();
console.log(`built the fixture into ${outDir}`);
