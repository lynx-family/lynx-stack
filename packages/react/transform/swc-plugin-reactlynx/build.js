// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

execSync('cargo build-wasi --release', {
  env: {
    ...process.env,
    RUSTFLAGS: '-C link-arg=--export-table -C link-arg=-s',
  },
  stdio: 'inherit',
});

await fs.copyFile(
  path.resolve(
    __dirname,
    '../../../../target/wasm32-wasip1/release/swc_plugin_reactlynx.wasm',
  ),
  path.resolve(__dirname, 'swc_plugin_reactlynx.wasm'),
);
