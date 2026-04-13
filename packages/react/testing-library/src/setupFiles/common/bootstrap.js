globalThis.onInjectMainThreadGlobals(
  globalThis.lynxTestingEnv.mainThread.globalThis,
);
globalThis.onInjectBackgroundThreadGlobals(
  globalThis.lynxTestingEnv.backgroundThread.globalThis,
);
