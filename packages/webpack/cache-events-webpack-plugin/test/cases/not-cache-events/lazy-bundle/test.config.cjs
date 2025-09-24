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
            1: function(
              __unused_webpack___webpack_module__,
              __webpack_exports__,
              __webpack_require__,
            ) {
              __webpack_require__.d(__webpack_exports__, {
                default: () => __WEBPACK_DEFAULT_EXPORT__,
              });
              /* ESM default export */ const __WEBPACK_DEFAULT_EXPORT__ = () =>
                null;
            },
          },
        });
      },
    };
  },
};
