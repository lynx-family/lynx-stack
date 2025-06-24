// Copyright 2024 The Lynx Authors. All rights reserved.
// Licensed under the Apache License Version 2.0 that can be found in the
// LICENSE file in the root directory of this source tree.
__injectGlobals(globalThis);

function __injectGlobals(target) {
  target.__DEV__ = false;
  target.__LEPUS__ = false;
  target.__MAIN_THREAD__ = false;
  target.__REF_FIRE_IMMEDIATELY__ = false;
  target.__FIRST_SCREEN_SYNC_TIMING__ = 'immediately';
  target.lynx = {};
  target.lynxCoreInject = {};
  target.lynxCoreInject.tt = {};
  target.lynxCoreInject.tt.publicComponentEvent = () => void 0;
  target.lynxCoreInject.tt._params = { updateData: {} };
  target.lynxCoreInject.tt._nativeApp = {
    nativeModuleProxy: {},
  };
  target.__OnLifecycleEventQueue = [];
  target.__OnLifecycleEvent = args => {
    target.__OnLifecycleEventQueue.push(args);
  };
  target.lynx.createSelectorQuery = () => ({
    selectUniqueID: uid => ({ uid }),
  });
}
