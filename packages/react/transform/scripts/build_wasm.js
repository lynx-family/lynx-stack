// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
import { execSync } from 'node:child_process';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import esbuild from 'esbuild';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const root = path.dirname(__dirname);
const dist = path.resolve(root, 'dist');

// mkdir -p dist
await fs.mkdir('dist', { recursive: true });
execSync(`cargo build --release --target wasm32-unknown-unknown --features noop`, {
  env: {
    ...process.env,
    RUSTFLAGS: '-C link-arg=--export-table -C link-arg=-s --cfg getrandom_backend="custom"',
  },
  stdio: 'inherit',
});

// cp ../../../target/wasm32-unknown-unknown/release/react_transform.wasm dist/react_transform.wasm
await fs.copyFile(
  path.resolve(
    root,
    '../../../target/wasm32-unknown-unknown/release/react_transform.wasm',
  ),
  path.resolve(dist, 'react_transform.wasm'),
);

/** @type {import('esbuild').BuildOptions} */
const commonOptions = {
  entryPoints: [path.resolve(root, 'src/wasm.js')],
  bundle: true,
  loader: {
    '.wasm': 'binary',
  },
  platform: 'neutral',
  target: 'es2022',
};

await Promise.all([
  esbuild.build({
    ...commonOptions,
    format: 'cjs',
    outfile: path.resolve(dist, 'wasm.cjs'),
  }),
]);

await fs.rm(path.resolve(dist, 'react_transform.wasm'), { force: true });
