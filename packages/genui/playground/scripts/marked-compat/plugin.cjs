// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
const path = require('node:path');

exports.pluginMarkedUnicode = function pluginMarkedUnicode() {
  return {
    name: 'genui:marked-unicode',
    setup(api) {
      api.modifyBundlerChain((chain) => {
        // Run before SWC, which separately transforms regex literals.
        chain.module.rule('marked-unicode')
          .test(/[\\/]marked[\\/]lib[\\/]marked\.esm\.js$/)
          .enforce('pre')
          .use('marked-unicode')
          .loader(path.join(__dirname, 'loader.cjs'));
      });
    },
  };
};
