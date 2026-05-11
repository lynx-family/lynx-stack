// Copyright 2026 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
function lazyComponent() {
  return null;
}

export function findBundle() {
  return 'main.js';
}

export function beforeExecute() {
  const chunkId =
    'test_configCases_not-cache-events_lazy-bundle_lazy-component_js';

  global.lynxCoreInject = {
    tt: {},
  };
  global.lynx = {
    requireModuleAsync: (_request, callback) => {
      callback(null, {
        ids: [chunkId],
        modules: {
          '../test/configCases/not-cache-events/lazy-bundle/lazy-component.js':
            function(
              __unused_webpack___webpack_module__,
              __webpack_exports__,
              __webpack_require__,
            ) {
              __webpack_require__.r(__webpack_exports__);
              __webpack_require__.d(__webpack_exports__, {
                default: () => __WEBPACK_DEFAULT_EXPORT__,
              });
              /* ESM default export */ const __WEBPACK_DEFAULT_EXPORT__ =
                lazyComponent;
            },
        },
        runtime: (__webpack_require__) => {
          __webpack_require__.r = (exports) => {
            if (typeof Symbol !== 'undefined' && Symbol.toStringTag) {
              Object.defineProperty(exports, Symbol.toStringTag, {
                value: 'Module',
              });
            }
            Object.defineProperty(exports, '__esModule', { value: true });
          };
        },
      });
    },
  };
}
