// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.

/** @type {import("@lynx-js/test-tools").TConfigCaseConfig} */
module.exports = {
  beforeExecute() {
    global.lynx ??= {};
    delete global.lynx.__runtime_configs__;
  },
};
