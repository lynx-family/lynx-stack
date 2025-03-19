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
    '../../../../target/wasm32-wasi/release/swc_plugin_compat.wasm',
  ),
  path.resolve(__dirname, 'swc_plugin_compat.wasm'),
);

execSync('cargo test export_bindings', {
  env: {
    ...process.env,
    TS_RS_EXPORT_DIR: __dirname,
  },
  stdio: 'inherit',
});

const tsFilePath = path.resolve(__dirname, 'index.d.ts');

execSync(`npx dprint fmt ${tsFilePath}`);
