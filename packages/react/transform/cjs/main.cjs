// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* eslint-disable n/no-unpublished-require */

const { default: _exports } = require('../dist/wasm.cjs');

// eslint-disable-next-line n/no-missing-require
module.exports = process.env['USE_NAPI'] ? require('../index.cjs') : _exports;
