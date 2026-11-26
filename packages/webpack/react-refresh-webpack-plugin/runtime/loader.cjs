// @ts-nocheck
const isPrefreshComponent = __prefresh_utils__.shouldBind(module);

const moduleHot = module.hot;

if (moduleHot) {
  const currentExports = __prefresh_utils__.getExports(module);

  __prefresh_utils__.registerExports(currentExports, module.id);

  if (isPrefreshComponent) {
    // `moduleHot.data` is set whenever this evaluation replaces an earlier
    // instance, including one that never ran this footer (the error module of
    // a failed build), so a fix right after a failed build is flushed too.
    if (moduleHot.data) {
      try {
        __prefresh_utils__.flush();
        if (
          typeof __prefresh_errors__ !== 'undefined'
          && __prefresh_errors__
          && __prefresh_errors__.clearRuntimeErrors
        ) {
          __prefresh_errors__.clearRuntimeErrors();
        }
      } catch (e) {
        // Only available in newer webpack versions.
        if (moduleHot.invalidate) {
          moduleHot.invalidate();
        } else {
          globalThis.location.reload();
        }
      }
    }

    moduleHot.dispose(data => {
      data.moduleExports = __prefresh_utils__.getExports(module);
    });

    moduleHot.accept(function errorRecovery() {
      if (
        typeof __prefresh_errors__ !== 'undefined'
        && __prefresh_errors__
        && __prefresh_errors__.handleRuntimeError
      ) {
        __prefresh_errors__.handleRuntimeError(error);
      }

      require.cache[module.id].hot.accept(errorRecovery);
    });
  }
}
