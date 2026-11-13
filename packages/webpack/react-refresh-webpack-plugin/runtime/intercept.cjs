// @ts-nocheck
(function() {
  var refreshHolder = {
    runtime: null,
    legacy: false,
  };
  var initRefreshHolder = function(ReactRefresh) {
    if (!ReactRefresh) {
      return;
    }
    if (typeof ReactRefresh.createRefreshRuntime === 'function') {
      if (!refreshHolder.runtime) {
        refreshHolder.runtime = ReactRefresh.createRefreshRuntime();
      }
      refreshHolder.legacy = false;
      return;
    }
    // Older `@lynx-js/react/refresh` without `createRefreshRuntime`: fall back to
    // `globalThis.__PREFRESH__` for single-template compatibility.
    refreshHolder.legacy = true;
  };
  var getRegistry = function() {
    if (refreshHolder.runtime) {
      return refreshHolder.runtime;
    }
    return refreshHolder.legacy && typeof globalThis !== 'undefined'
      ? globalThis.__PREFRESH__
      : null;
  };
  var isRefreshRuntimeExports = function(exported) {
    return Boolean(
      exported
        && (typeof exported === 'object' || typeof exported === 'function')
        && typeof exported.flush === 'function'
        && typeof exported.isComponent === 'function',
    );
  };

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
      return;
    }
    var originalFactory = options.factory;
    options.factory = function(moduleObject, moduleExports, webpackRequire) {
      var prevRefreshReg = globalThis.$RefreshReg$;
      var prevRefreshSig = globalThis.$RefreshSig$;
      var prevRefreshBind = globalThis.$RefreshBind$;
      globalThis.$RefreshBind$ = function() {
        return refreshHolder;
      };
      globalThis.$RefreshSig$ = function() {
        var status = 'begin';
        var savedType;

        return function(type, key, forceReset, getCustomHooks) {
          var registry = getRegistry();
          if (!registry) {
            return type;
          }
          if (!savedType) savedType = type;

          status = registry.sign(
            type || savedType,
            key,
            forceReset,
            getCustomHooks,
            status,
          );
          return type;
        };
      };
      var reg = function(currentModuleId) {
        globalThis.$RefreshReg$ = function(type, id) {
          var registry = getRegistry();
          if (registry) {
            registry.register(type, currentModuleId + ' ' + id);
          }
        };
      };
      reg(moduleObject.id);
      try {
        originalFactory.call(this, moduleObject, moduleExports, webpackRequire);
        if (
          !refreshHolder.runtime
          && !refreshHolder.legacy
          && isRefreshRuntimeExports(moduleObject.exports)
        ) {
          initRefreshHolder(moduleObject.exports);
        }
      } finally {
        globalThis.$RefreshReg$ = prevRefreshReg;
        globalThis.$RefreshSig$ = prevRefreshSig;
        globalThis.$RefreshBind$ = prevRefreshBind;
      }
    };
  });

  globalThis[Symbol.for('__LYNX_WEBPACK_MODULES__')] = __webpack_modules__;
})();
