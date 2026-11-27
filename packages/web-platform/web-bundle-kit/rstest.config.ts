// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { realpathSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from '@rstest/core';
import type { RstestConfig } from '@rstest/core';

const root = path.dirname(fileURLToPath(import.meta.url));

// The stand-ins import @napi-rs/wasm-runtime/fs, a dependency of
// @rspack/browser that the kit's build aliases to its `dist/fs.js`; the tests
// do the same.
const rspackBrowser = realpathSync(
  path.join(root, 'node_modules/@rspack/browser'),
);
const napiRuntime = path.dirname(
  createRequire(path.join(rspackBrowser, 'package.json')).resolve(
    '@napi-rs/wasm-runtime',
  ),
);

const config: RstestConfig = defineConfig({
  root,
  name: 'web-platform/web-bundle-kit',
  include: ['./test/*.test.ts'],
  resolve: {
    alias: {
      '@napi-rs/wasm-runtime/fs$': path.join(napiRuntime, 'dist/fs.js'),
    },
  },
});

export default config;
