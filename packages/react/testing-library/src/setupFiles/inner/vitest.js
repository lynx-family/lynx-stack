const {
  onInjectBackgroundThreadGlobals,
} = globalThis;

globalThis.onInjectBackgroundThreadGlobals = (target) => {
  if (onInjectBackgroundThreadGlobals) {
    onInjectBackgroundThreadGlobals(target);
  }

  target.lynx.requireModuleAsync = async (url, callback) => {
    try {
      callback(null, await __vite_ssr_dynamic_import__(url));
    } catch (err) {
      callback(err, null);
    }
  };
};
