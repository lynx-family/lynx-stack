// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/// <reference path="./packages.d.ts" />

// The Buffer of @rspack/browser's memfs, so buffers from `fs` and from
// Node.js code are the same class.
import { Buffer } from '@napi-rs/wasm-runtime/fs';

const buffer = {
  Buffer,
  kMaxLength: 0x7fffffff,
  constants: { MAX_LENGTH: 0x7fffffff },
};

export const { kMaxLength, constants } = buffer;
export { Buffer };
export default buffer;
