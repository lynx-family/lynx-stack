// @ts-nocheck
__webpack_require__.i.push(function(options) {
  if (
    // Loading a module of background layer in main-thread, we replace the layer with the main-thread.
    !__webpack_modules__[options.id]
    && typeof options.id === 'string'
    && options.id.includes('($BACKGROUND_LAYER$)')
  ) {
    // We may serialize the snapshot from background to main-thread.
    // The `(react:background)` layer in the module id cannot be found in the main-thread.
    // Thus we replace it here to make HMR work.
    //
    // Maybe it is better to run chunk loading on main thread.
    var mainThreadId = options.id.replace(
      `($BACKGROUND_LAYER$)`, // This is replaced by ReactRefreshRspackPlugin
      '($MAIN_THREAD_LAYER$)', // This is replaced by ReactRefreshRspackPlugin
    );
    const factory = __webpack_modules__[mainThreadId];
    if (factory) {
      options.id = mainThreadId;
      options.factory = factory;
    }
  }
});

globalThis[Symbol.for('__LYNX_WEBPACK_MODULES__')] = __webpack_modules__;
