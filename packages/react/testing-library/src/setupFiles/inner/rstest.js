const {
  onInjectBackgroundThreadGlobals,
} = globalThis;

globalThis.onInjectBackgroundThreadGlobals = (target) => {
  if (onInjectBackgroundThreadGlobals) {
    onInjectBackgroundThreadGlobals(target);
  }

  target.lynx.requireModuleAsync = async (url, _callback) => {
    throw new Error('lynx.requireModuleAsync not implemented for rstest');
  };
};
