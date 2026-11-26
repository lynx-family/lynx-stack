// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The `browser` entry of `@lynx-js/react/transform`: the wasm build only.
// `main.cjs` also requires the napi build (`../index.cjs`), which is not
// published, so a bundler targeting the browser could not resolve it.

/* eslint-disable n/no-unpublished-require */

module.exports = require('../dist/wasm.cjs').default;
