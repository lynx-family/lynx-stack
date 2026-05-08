// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
function add(a, b) {
  return a + b;
}

export function findBundle() {
  return 'main.js';
}

export function beforeExecute() {
  global.lynxCoreInject = {
    tt: {},
  };
  global.lynx = {
    requireModuleAsync: (_request, callback) => {
      callback(null, {
        ids: ['0'],
        modules: {
          './cache-events/chunk-splitting/lib-common.js': function(
            __unused_webpack___webpack_module__,
            __webpack_exports__,
            __webpack_require__,
          ) {
            __webpack_require__.d(__webpack_exports__, {
              add: () => add,
            });
          },
        },
      });
    },
  };
}
