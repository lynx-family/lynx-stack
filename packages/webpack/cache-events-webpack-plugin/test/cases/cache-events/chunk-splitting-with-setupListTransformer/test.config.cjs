/** @type {import("@lynx-js/test-tools").TConfigCaseConfig} */
module.exports = {
  bundlePath: [
    'main.js',
  ],
  beforeExecute: () => {
    global.lynxCoreInject = {
      tt: {},
    };
    global.lynx = {
      requireModuleAsync: (_request, callback) => {
        callback(null, {
          ids: ['0'],
          modules: {
            './cache-events/chunk-splitting-with-setupListTransformer/lib-common.js':
              function(
                __unused_webpack___webpack_module__,
                __webpack_exports__,
                __webpack_require__,
              ) {
                const add = (a, b) => a + b;
                __webpack_require__.d(__webpack_exports__, {
                  add: () => add,
                });
              },
          },
        });
      },
    };
  },
};
