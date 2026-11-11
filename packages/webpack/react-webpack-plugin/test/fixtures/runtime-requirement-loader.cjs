// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
module.exports = function runtimeRequirementLoader(source) {
  this._module.buildInfo['lynx:react-runtime-requirements'] = {
    mainThreadProgrammability: this.resourcePath.endsWith('unused.js'),
  };
  return source;
};
