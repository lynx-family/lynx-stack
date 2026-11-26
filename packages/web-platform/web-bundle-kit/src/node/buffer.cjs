// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

// The Buffer of @rspack/browser's memfs, so buffers from `fs` and from
// Node.js code are the same class.
const { Buffer } = require('@napi-rs/wasm-runtime/fs');

module.exports = {
  Buffer,
  kMaxLength: 0x7fffffff,
  constants: { MAX_LENGTH: 0x7fffffff },
};
