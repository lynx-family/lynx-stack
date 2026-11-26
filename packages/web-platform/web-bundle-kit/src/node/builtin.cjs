// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/* global __resourceQuery */

// The kit's build aliases `node:<name>` and `<name>` to `builtin.cjs?<name>`.
module.exports = require('./builtins.cjs')[__resourceQuery.slice(1)];
